import keytar from 'keytar';

const SERVICE_NAME = 'saas-agent';

/** 获取存储的 token */
export async function getToken(provider: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, provider);
}

/** 存储 token 到系统钥匙串 */
export async function saveToken(provider: string, token: string): Promise<void> {
  await keytar.setPassword(SERVICE_NAME, provider, token);
}

/** 删除存储的 token */
export async function deleteToken(provider: string): Promise<void> {
  await keytar.deletePassword(SERVICE_NAME, provider);
}

/** 检查是否已存储 token */
export async function hasToken(provider: string): Promise<boolean> {
  const token = await getToken(provider);
  return token !== null;
}
