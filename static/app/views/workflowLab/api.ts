import {skipToken} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';

export interface LabConfig {
  fixture: Record<string, unknown>;
  graph: Plan;
  input: Record<string, unknown>;
  scenarios: Record<string, {description: string; label: string}>;
  schemas: Record<string, unknown>;
  skills: Record<string, string>;
  workflow: Record<string, unknown>;
}

export interface Plan {
  dependencies: Record<string, string[]>;
  order: string[];
  output: string;
}

export interface AcceptedRun {
  id: string;
  notebook: boolean;
}

export interface Run extends AcceptedRun {
  activity: Array<{
    child: number;
    id: string;
    message: string | null;
    node: string;
    role: string;
    time: string;
    tools: string[];
  }>;
  createdAt: string;
  done: boolean;
  error: unknown;
  finishedAt: string | null;
  input: unknown;
  nodes: Array<{
    attempt: number;
    child: number | null;
    error: unknown;
    id: string;
    input: unknown;
    item: number | null;
    name: string;
    output: unknown;
    parent: string | null;
    round: number | null;
    status: string;
  }>;
  notebookId: string | null;
  output: unknown;
  status: string;
  usage: {dollarCost: number; totalTokens: number; usages: unknown[]};
  workflow: LabConfig['workflow'];
}

export interface ProofResult {
  events: Array<{kind: string; message?: string; output?: unknown}>;
  success: boolean;
}

export function configOptions(org: string) {
  return apiOptions.as<LabConfig>()(
    '/organizations/$organizationIdOrSlug/workflow-lab/',
    {
      path: {organizationIdOrSlug: org},
      staleTime: Infinity,
    }
  );
}

export function runOptions(org: string, id: string | null, activity: boolean) {
  return apiOptions.as<Run>()(
    '/organizations/$organizationIdOrSlug/workflow-lab/runs/$runId/',
    {
      path: id ? {organizationIdOrSlug: org, runId: id} : skipToken,
      query: {activity: activity ? '1' : undefined},
      staleTime: 0,
    }
  );
}
