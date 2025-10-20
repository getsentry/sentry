import {createContext, useContext} from 'react';

import type {DetectorType} from 'sentry/types/workflowEngine/detectors';

interface MonitorViewContextValue {
  automationsLinkPrefix: string;
  monitorsLinkPrefix: string;
  assigneeFilter?: string;
  detectorFilter?: DetectorType;
}

const DEFAULT_MONITOR_VIEW_CONTEXT: MonitorViewContextValue = {
  monitorsLinkPrefix: 'issues/monitors',
  automationsLinkPrefix: 'issues/automations',
  assigneeFilter: undefined,
  detectorFilter: undefined,
};

export const MonitorViewContext = createContext<MonitorViewContextValue>(
  DEFAULT_MONITOR_VIEW_CONTEXT
);

export function useMonitorViewContext(): MonitorViewContextValue {
  return useContext(MonitorViewContext);
}
