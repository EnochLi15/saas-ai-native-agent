import { mkdir, appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export interface AuditLogEntry {
  timestamp: string;
  provider: string;
  capability_id: string;
  pending_action_id: string;
  status: 'approved' | 'failed' | 'rejected';
  summary: string;
  result?: Record<string, unknown>;
  error?: {
    code: string;
    message: string;
  };
}

function auditLogPath(): string {
  if (process.env.SAAS_AGENT_AUDIT_LOG) {
    return process.env.SAAS_AGENT_AUDIT_LOG;
  }

  const baseDir = process.env.SAAS_AGENT_HOME || join(homedir(), '.saas-agent');
  return join(baseDir, 'audit-log.jsonl');
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const file = auditLogPath();
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(entry) + '\n', 'utf-8');
}
