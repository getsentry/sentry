export interface FlowDefinition {
  createdAt: string;
  createdBy: {
    email: string;
    id: string;
    name: string;
    avatar?: string;
  };
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'draft';
  steps: FlowStep[];
  updatedAt: string;
  version: string;
  description?: string;
  lastSeen?: string;
}

export interface FlowStep {
  config: Record<string, any>;
  id: string;
  name: string;
  order: number;
  type: 'action' | 'condition' | 'wait';
  description?: string;
}

export interface FlowInstance {
  data: Record<string, any>;
  flowId: string;
  id: string;
  startedAt: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  completedAt?: string;
  currentStep?: string;
}
