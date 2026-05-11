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
