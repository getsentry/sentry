export interface Flow {
  id: string;
  name: string;
  description?: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  status: 'active' | 'inactive' | 'draft';
  createdAt: string;
  updatedAt: string;
  lastSeen?: string;
  replayId?: string;
  projectId: string;
  organizationId: string;
}

export interface FlowDefinition {
  id: string;
  name: string;
  description?: string;
  steps: FlowStep[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface FlowStep {
  id: string;
  name: string;
  description?: string;
  type: 'action' | 'condition' | 'wait';
  config: Record<string, any>;
  order: number;
}

export interface FlowInstance {
  id: string;
  flowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentStep?: string;
  startedAt: string;
  completedAt?: string;
  data: Record<string, any>;
}
