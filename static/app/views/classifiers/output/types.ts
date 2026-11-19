import type {PageFilters} from 'sentry/types/core';
import type {TelemetryClassifier} from 'sentry/views/classifiers/types';
import type {ChartType} from 'sentry/views/insights/common/components/chartTypes';

export interface ClassifierVisualizationProps {
  chartType: ChartType;
  classifier: TelemetryClassifier;
  filter: string;
  interval: string | undefined;
  pageFilters: PageFilters;
}

export interface ClassifierOutput {
  ResultCell: React.ComponentType<{classifier: TelemetryClassifier; value: number}>;
  Visualization: React.ComponentType<ClassifierVisualizationProps>;
  defaultFilter: string;
  filterOptions: Array<{label: string; value: string}>;
  getResultQuery: (classifier: TelemetryClassifier, filter: string) => string;
}
