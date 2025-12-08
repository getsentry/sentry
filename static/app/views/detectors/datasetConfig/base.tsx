import type {SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {
  MetricDetectorConfig,
  SnubaQuery,
} from 'sentry/types/workflowEngine/detectors';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import type {
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
import type {
  MetricDetectorInterval,
  MetricDetectorTimePeriod,
} from 'sentry/views/detectors/datasetConfig/utils/timePeriods';
import type {FieldValue} from 'sentry/views/discover/table/types';

export interface DetectorSearchBarProps {
  environment: string;
  initialQuery: string;
  onClose: (query: string, state: {validSearch: boolean}) => void;
  onSearch: (query: string) => void;
  projectIds: number[];
  dataset?: DiscoverDatasets;
  disabled?: boolean;
}

interface DetectorSeriesQueryOptions {
  /**
   * The aggregate to use for the series query. eg: `count()`
   */
  aggregate: string;
  /**
   * Comparison delta in seconds for % change alerts
   */
  comparisonDelta: number | undefined;
  dataset: Dataset;
  environment: string;
  eventTypes: EventTypes[];
  /**
   * Metric detector interval in seconds
   */
  interval: number;
  organization: Organization;
  projectId: string;
  /**
   * The filter query. eg: `span.op:http`
   */
  query: string;
  end?: string | null;
  /**
   * Extra query parameters to pass
   */
  extra?: {
    useOnDemandMetrics: 'true';
  };
  extrapolationMode?: ExtrapolationMode;
  start?: string | null;
  /**
   * Relative time period for the query. Example: '7d'.
   */
  statsPeriod?: string | null;
}

/**
 * Minimal configuration interface for detector dataset configs.
 * Contains only the properties actually used by the detectors form.
 */
export interface DetectorDatasetConfig<SeriesResponse> {
  /**
   * Dataset specific search bar for the 'Filter' step in the
   * widget builder.
   */
  SearchBar: (props: DetectorSearchBarProps) => React.JSX.Element;
  /**
   * Default event types for this dataset
   */
  defaultEventTypes: EventTypes[];
  /**
   * Default field to use when the dataset is first selected
   */
  defaultField: QueryFieldValue;
  /**
   * Transform the aggregate function from the API response to a more user friendly title.
   * This is currently only used for the releases dataset.
   */
  fromApiAggregate: (aggregate: string) => string;
  /**
   * Field options to display in the aggregate and field selectors
   */
  getAggregateOptions: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection
  ) => Record<string, SelectValue<FieldValue>>;
  getDiscoverDataset: () => DiscoverDatasets;
  /**
   * An array of intervals available for the current dataset.
   */
  getIntervals: (options: {
    detectionType: MetricDetectorConfig['detectionType'];
  }) => readonly MetricDetectorInterval[];
  getSeriesQueryOptions: (options: DetectorSeriesQueryOptions) => ApiQueryKey;
  /**
   * Based on the interval, returns an array of time periods.
   */
  getTimePeriods: (
    interval: MetricDetectorInterval
  ) => readonly MetricDetectorTimePeriod[];
  name: string;
  /**
   * Extracts event types from the query string
   */
  separateEventTypesFromQuery: (query: string) => {
    eventTypes: EventTypes[];
    query: string;
  };
  supportedDetectionTypes: Array<MetricDetectorConfig['detectionType']>;
  /**
   * Transform the user-friendly aggregate function to the API aggregate function.
   * This is currently only used for the releases dataset.
   */
  toApiAggregate: (aggregate: string) => string;
  /**
   * Adds additional event types to the query string
   */
  toSnubaQueryString: (
    snubaQuery: Pick<SnubaQuery, 'eventTypes' | 'query'> | undefined
  ) => string;
  /**
   * Transform comparison series data for % change alerts
   */
  transformComparisonSeriesData: (data: SeriesResponse | undefined) => Series[];
  /**
   * Transform the result from `getSeriesQueryOptions` to a chart series
   */
  transformSeriesQueryData: (
    data: SeriesResponse | undefined,
    aggregate: string
  ) => Series[];

  /**
   * When automatically generating a detector name, this function will be called to format the aggregate function.
   * If this function is not provided, the aggregate function will be used as is.
   *
   * e.g. For the errors dataset, count() will be formatted as 'Number of errors'
   */
  formatAggregateForTitle?: (aggregate: string) => string;
}
