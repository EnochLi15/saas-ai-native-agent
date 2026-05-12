import { GraphQLClient } from 'graphql-request';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

function createClient(token: string): GraphQLClient {
  return new GraphQLClient(LINEAR_API_URL, {
    headers: { Authorization: token },
  });
}

// ── Types ──

interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

interface ValidateTokenResult {
  valid: boolean;
  viewer: LinearViewer | null;
}

export interface LinearTeam {
  id: string;
  key: string;
  name: string;
}

export interface SearchTeamsResult {
  teams: LinearTeam[];
}

export interface SearchIssuesOptions {
  team?: string;
  status?: string;
  assignee?: string;
  label?: string;
  updatedBefore?: string;
  updatedAfter?: string;
  limit?: number;
  cursor?: string;
}

export interface LinearIssueSummary {
  id: string;
  identifier: string;
  title: string;
  state: string | null;
  priority: string;
  assignee: string | null;
  labels: string[];
  updated_at: string;
  url: string;
}

export interface SearchIssuesResult {
  issues: LinearIssueSummary[];
  page_info: {
    has_next_page: boolean;
    end_cursor: string | null;
  };
}

export interface LinearCommentSummary {
  id: string;
  body: string;
  author: string | null;
  created_at: string;
}

export interface LinearIssueDetail extends LinearIssueSummary {
  description: string | null;
  project: string | null;
  created_at: string;
  comments: LinearCommentSummary[];
}

export interface LinearCommentCreateResult {
  id: string | null;
  url: string | null;
}

export class LinearNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinearNotFoundError';
  }
}

interface LinearIssueNode {
  id: string;
  identifier: string;
  title: string;
  state: { name: string } | null;
  priorityLabel: string | null;
  assignee: { name: string } | null;
  labels: { nodes: Array<{ name: string }> };
  updatedAt: string;
  url: string;
}

interface LinearIssueDetailNode extends LinearIssueNode {
  description: string | null;
  createdAt: string;
  project: { name: string } | null;
  comments: {
    nodes: Array<{
      id: string;
      body: string;
      user: { name: string } | null;
      createdAt: string;
    }>;
  };
}

// ── Auth ──

/** 使用简单 viewer 查询验证 Linear token */
export async function validateLinearToken(token: string): Promise<ValidateTokenResult> {
  const client = createClient(token);

  try {
    const data = await client.request<{ viewer: LinearViewer }>(`
      query {
        viewer {
          id
          name
          email
        }
      }
    `);

    return {
      valid: true,
      viewer: data.viewer,
    };
  } catch (err: unknown) {
    const message = (err as Error)?.message || '';
    if (
      message.includes('Authentication') ||
      message.includes('Unauthorized') ||
      message.includes('Invalid token') ||
      message.includes('invalid')
    ) {
      return { valid: false, viewer: null };
    }
    return { valid: false, viewer: null };
  }
}

// ── Teams ──

export async function searchTeams(
  token: string,
  query?: string,
  limit = 20,
): Promise<SearchTeamsResult> {
  const client = createClient(token);

  const gql = `
    query($first: Int) {
      teams(first: $first) {
        nodes {
          id
          key
          name
        }
      }
    }
  `;

  const data = await client.request<{
    teams: { nodes: LinearTeam[] };
  }>(gql, { first: limit });

  let teams = data.teams.nodes;

  // 客户端过滤：按 name 或 key 匹配
  if (query) {
    const q = query.toLowerCase();
    teams = teams.filter(
      (t) => t.name.toLowerCase().includes(q) || t.key.toLowerCase().includes(q),
    );
  }

  return { teams };
}

async function resolveTeamId(token: string, team: string): Promise<string> {
  const client = createClient(token);
  const data = await client.request<{
    teams: { nodes: LinearTeam[] };
  }>(`
    query($first: Int!) {
      teams(first: $first) {
        nodes {
          id
          key
          name
        }
      }
    }
  `, { first: 100 });

  const normalized = team.toLowerCase();
  const match = data.teams.nodes.find(
    (candidate) =>
      candidate.id === team ||
      candidate.key.toLowerCase() === normalized ||
      candidate.name.toLowerCase() === normalized,
  );

  if (!match) {
    throw new LinearNotFoundError(`Linear team "${team}" was not found.`);
  }

  return match.id;
}

function buildIssueFilter(options: SearchIssuesOptions, teamId?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (teamId) {
    filter.team = { id: { eq: teamId } };
  }

  if (options.status) {
    filter.state = { name: { eqIgnoreCase: options.status } };
  }

  if (options.assignee) {
    if (options.assignee.includes('@')) {
      filter.assignee = { email: { eqIgnoreCase: options.assignee } };
    } else {
      filter.assignee = {
        or: [
          { id: { eq: options.assignee } },
          { name: { eqIgnoreCase: options.assignee } },
        ],
      };
    }
  }

  if (options.label) {
    filter.labels = { name: { eqIgnoreCase: options.label } };
  }

  if (options.updatedBefore || options.updatedAfter) {
    filter.updatedAt = {
      ...(options.updatedBefore ? { lt: options.updatedBefore } : {}),
      ...(options.updatedAfter ? { gt: options.updatedAfter } : {}),
    };
  }

  return filter;
}

function mapIssue(node: LinearIssueNode): LinearIssueSummary {
  return {
    id: node.id,
    identifier: node.identifier,
    title: node.title,
    state: node.state?.name ?? null,
    priority: node.priorityLabel ?? 'No priority',
    assignee: node.assignee?.name ?? null,
    labels: node.labels.nodes.map(label => label.name),
    updated_at: node.updatedAt,
    url: node.url,
  };
}

function mapIssueDetail(node: LinearIssueDetailNode): LinearIssueDetail {
  return {
    ...mapIssue(node),
    description: node.description,
    project: node.project?.name ?? null,
    created_at: node.createdAt,
    comments: node.comments.nodes.map(comment => ({
      id: comment.id,
      body: comment.body,
      author: comment.user?.name ?? null,
      created_at: comment.createdAt,
    })),
  };
}

export async function searchIssues(
  token: string,
  options: SearchIssuesOptions = {},
): Promise<SearchIssuesResult> {
  const client = createClient(token);
  const first = options.limit ?? 20;
  const teamId = options.team ? await resolveTeamId(token, options.team) : undefined;
  const filter = buildIssueFilter(options, teamId);

  const gql = `
    query($first: Int!, $after: String, $filter: IssueFilter) {
      issues(first: $first, after: $after, filter: $filter, orderBy: updatedAt) {
        nodes {
          id
          identifier
          title
          state {
            name
          }
          priorityLabel
          assignee {
            name
          }
          labels {
            nodes {
              name
            }
          }
          updatedAt
          url
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const data = await client.request<{
    issues: {
      nodes: LinearIssueNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  }>(gql, {
    first,
    after: options.cursor,
    filter: Object.keys(filter).length > 0 ? filter : undefined,
  });

  return {
    issues: data.issues.nodes.map(mapIssue),
    page_info: {
      has_next_page: data.issues.pageInfo.hasNextPage,
      end_cursor: data.issues.pageInfo.endCursor,
    },
  };
}

export async function getIssue(token: string, idOrIdentifier: string): Promise<LinearIssueDetail> {
  const client = createClient(token);

  const data = await client.request<{
    issue: LinearIssueDetailNode | null;
  }>(`
    query($id: String!) {
      issue(id: $id) {
        id
        identifier
        title
        description
        state {
          name
        }
        priorityLabel
        assignee {
          name
        }
        labels {
          nodes {
            name
          }
        }
        project {
          name
        }
        createdAt
        updatedAt
        url
        comments(first: 20) {
          nodes {
            id
            body
            user {
              name
            }
            createdAt
          }
        }
      }
    }
  `, { id: idOrIdentifier });

  if (!data.issue) {
    throw new LinearNotFoundError(`Linear issue "${idOrIdentifier}" was not found.`);
  }

  return mapIssueDetail(data.issue);
}

export async function createLinearComment(
  token: string,
  input: { issueId: string; body: string },
): Promise<LinearCommentCreateResult> {
  const client = createClient(token);

  const data = await client.request<{
    commentCreate: {
      success: boolean;
      comment: { id: string; url: string | null } | null;
    };
  }>(`
    mutation($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        success
        comment {
          id
          url
        }
      }
    }
  `, {
    input: {
      issueId: input.issueId,
      body: input.body,
    },
  });

  if (!data.commentCreate.success) {
    throw new Error('Linear commentCreate returned success=false.');
  }

  return {
    id: data.commentCreate.comment?.id ?? null,
    url: data.commentCreate.comment?.url ?? null,
  };
}
