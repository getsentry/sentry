import {skipToken} from '@tanstack/react-query';

import type {Cell} from 'sentry/types/system';

import {apiOptions} from './api/apiOptions';

export type DebuggerItemType = 'workflow' | 'detector' | 'group' | 'event';
export type DebuggerPeriod = '1h' | '24h' | '7d';
export type DebuggerJsonValue =
  | null
  | boolean
  | number
  | string
  | DebuggerJsonValue[]
  | {[key: string]: DebuggerJsonValue};

export type DebuggerSearch = {
  id: string;
  statsPeriod: DebuggerPeriod;
  type: DebuggerItemType;
  projectId?: string;
};

export type DebuggerArtifact = {
  attributes: Record<string, DebuggerJsonValue>;
  itemId: string;
  projectId: string;
  timestamp: string;
  traceId: string;
};

export type WorkflowEngineDebuggerResponse = {
  artifacts: DebuggerArtifact[];
  end: string;
  item: {
    context: Record<string, DebuggerJsonValue>;
    id: string;
    name: string;
    organizationId: string;
    projectId: string | null;
    type: DebuggerItemType;
  };
  retentionDays: number;
  start: string;
  truncated: boolean;
};

export function workflowEngineDebuggerApiOptions(
  cell: Cell | undefined,
  search: DebuggerSearch | null
) {
  return {
    ...apiOptions.as<WorkflowEngineDebuggerResponse>()(
      '/_admin/cells/$cellId/workflow-engine/debugger/',
      {
        path: cell && search ? {cellId: cell.name} : skipToken,
        host: cell?.locality_url,
        query: search
          ? {
              type: search.type,
              id: search.id,
              statsPeriod: search.statsPeriod,
              ...(search.type === 'event' ? {projectId: search.projectId} : {}),
            }
          : undefined,
        staleTime: 0,
      }
    ),
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  };
}
