import type {User} from 'sentry/types/user';

export interface FlowDefinition {
  createdAt: string;
  createdBy: User;
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'draft';
  steps: FlowStep[];
  updatedAt: string;
  version: string;
  description?: string;
  environment?: string;
  lastSeen?: string;
  metadata?: {
    endBreadcrumb?: string;
    environment?: string;
    projectId?: number;
    replayId?: string;
    startBreadcrumb?: string;
  };
  orgSlug?: string;
  projectId?: number;
  sourceReplaySlug?: string;
}

export interface FlowDefinitionWithInstances extends FlowDefinition {
  instances?: FlowInstance[];
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
