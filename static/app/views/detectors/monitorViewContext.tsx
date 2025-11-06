import {createContext, useContext} from 'react';

import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';

export interface MonitorListAdditionalColumn {
  id: string;
  renderCell: (detector: Detector) => React.ReactNode;
  renderHeaderCell: () => React.ReactNode;
  /** Width of the column, defaults to auto */
  columnWidth?: string;
  renderPendingCell?: () => React.ReactNode;
}

export interface RenderVisualizationParams {
  detector: Detector | null;
}

export interface MonitorViewContextValue {
  /**
   * Additional columns to render after the default columns and before the visualization column.
   * These appear to the right of the default columns and to the left of the visualization.
   */
  additionalColumns?: MonitorListAdditionalColumn[];
  assigneeFilter?: string;
  detectorFilter?: Exclude<DetectorType, 'issue_stream'>;
  emptyState?: React.ReactNode;
  renderVisualization?: (params: RenderVisualizationParams) => React.ReactNode;
  showTimeRangeSelector?: boolean;
}

const DEFAULT_MONITOR_VIEW_CONTEXT: MonitorViewContextValue = {
  assigneeFilter: undefined,
  detectorFilter: undefined,
  showTimeRangeSelector: false,
  emptyState: null,
  additionalColumns: [],
};

export const MonitorViewContext = createContext<MonitorViewContextValue>(
  DEFAULT_MONITOR_VIEW_CONTEXT
);

export function useMonitorViewContext(): MonitorViewContextValue {
  return useContext(MonitorViewContext);
}
