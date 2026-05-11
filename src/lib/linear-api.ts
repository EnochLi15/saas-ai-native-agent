import { GraphQLClient } from 'graphql-request';

const LINEAR_API_URL = 'https://api.linear.app/graphql';

interface LinearViewer {
  id: string;
  name: string;
  email: string;
}

interface ValidateTokenResult {
  valid: boolean;
  viewer: LinearViewer | null;
}

/** 使用简单 viewer 查询验证 Linear token */
export async function validateLinearToken(token: string): Promise<ValidateTokenResult> {
  const client = new GraphQLClient(LINEAR_API_URL, {
    headers: { Authorization: token },
  });

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
    // 如果 token 无效，Linear 返回特定错误
    const message = (err as Error)?.message || '';
    if (
      message.includes('Authentication') ||
      message.includes('Unauthorized') ||
      message.includes('Invalid token') ||
      message.includes('invalid')
    ) {
      return { valid: false, viewer: null };
    }
    // 网络错误等 —— 返回 invalid 而不是抛出，让调用方处理
    // 区别是 viewer 为 null 且没有明确的错误类型
    return { valid: false, viewer: null };
  }
}
