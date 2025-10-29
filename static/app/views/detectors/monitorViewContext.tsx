import {createContext, useContext} from 'react';

import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

export interface MonitorViewContextValue {
  automationsLinkPrefix: string;
  monitorsLinkPrefix: string;
  assigneeFilter?: string;
  detectorFilter?: DetectorType;
  emptyState?: React.ReactNode;
  renderVisualization?: (detector: Detector) => React.ReactNode;
  showTimeRangeSelector?: boolean;
}

const DEFAULT_MONITOR_VIEW_CONTEXT: MonitorViewContextValue = {
  monitorsLinkPrefix: 'monitors',
  automationsLinkPrefix: 'monitors/alerts',
  assigneeFilter: undefined,
  detectorFilter: undefined,
  showTimeRangeSelector: false,
  emptyState: null,
};

export const MonitorViewContext = createContext<MonitorViewContextValue>(
  DEFAULT_MONITOR_VIEW_CONTEXT
);

export function useMonitorViewContext(): MonitorViewContextValue {
  return useContext(MonitorViewContext);
}
