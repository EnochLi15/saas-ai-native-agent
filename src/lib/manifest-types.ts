export interface CapabilityInputSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface CapabilityOutputSchema {
  type: string;
  properties?: Record<string, unknown>;
}

export interface CapabilityCliArgument {
  name: string;
  type: string;
  flag?: string;
  description?: string;
  default?: unknown;
}

export interface CapabilityCli {
  command: string;
  arguments: CapabilityCliArgument[];
}

export type CapabilityRisk = 'read' | 'write_propose' | 'admin';

export interface Capability {
  id: string;
  name: string;
  description: string;
  provider: string;
  resource: string;
  action: string;
  risk: CapabilityRisk;
  input_schema: CapabilityInputSchema;
  output_schema: CapabilityOutputSchema;
  cli: CapabilityCli;
}

export interface Manifest {
  provider: string;
  version: string;
  capabilities: Capability[];
}

/** 返回给 Agent 的 capability 摘要（list 命令） */
export interface CapabilitySummary {
  id: string;
  name: string;
  description: string;
  risk: CapabilityRisk;
  cli: {
    command: string;
  };
}

/** 返回给 Agent 的 capability 详情（show 命令） */
export type CapabilityDetail = Capability;
