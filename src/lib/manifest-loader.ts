import { readFileSync, readdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { load as parseYaml } from 'js-yaml';
import type { Manifest, Capability, CapabilitySummary, CapabilityDetail } from './manifest-types.js';

let manifests: Manifest[] | null = null;

function getManifestsDir(): string {
  // 开发时从项目根目录的 manifests/ 读取
  // 生产环境从 npm 包内读取
  const cwd = process.cwd();
  return resolve(cwd, 'manifests');
}

/** 加载所有 built-in manifest 文件 */
export function loadManifests(): Manifest[] {
  if (manifests) return manifests;

  const dir = getManifestsDir();
  manifests = [];

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const content = readFileSync(resolve(dir, file), 'utf-8');
      const parsed = parseYaml(content) as Manifest;

      if (!parsed.provider || !Array.isArray(parsed.capabilities)) {
        throw new Error(`Invalid manifest structure in ${file}: missing provider or capabilities`);
      }

      manifests.push(parsed);
    }
  } catch (err) {
    // 目录不存在或读取失败时返回空列表
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      manifests = [];
      return manifests;
    }
    throw err;
  }

  return manifests;
}

/** 获取所有 capability 的摘要列表 */
export function listCapabilities(): CapabilitySummary[] {
  const all = loadManifests();
  const summaries: CapabilitySummary[] = [];

  for (const manifest of all) {
    for (const cap of manifest.capabilities) {
      summaries.push({
        id: cap.id,
        name: cap.name,
        description: cap.description,
        risk: cap.risk,
        cli: {
          command: cap.cli.command,
        },
      });
    }
  }

  return summaries;
}

/** 按 id 查找单个 capability 详情 */
export function getCapability(id: string): CapabilityDetail | null {
  const all = loadManifests();

  for (const manifest of all) {
    for (const cap of manifest.capabilities) {
      if (cap.id === id) {
        return cap;
      }
    }
  }

  return null;
}

/** 重置缓存（仅用于测试） */
export function resetManifestCache(): void {
  manifests = null;
}
