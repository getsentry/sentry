import type {SelectValue} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import type {FieldValue} from 'sentry/views/discover/table/types';

export interface DetectorSearchBarProps {
  initialQuery: string;
  onClose: (query: string, state: {validSearch: boolean}) => void;
  onSearch: (query: string) => void;
  projectIds: number[];
  dataset?: DiscoverDatasets;
}

export interface DetectorSeriesQueryOptions {
  /**
   * The aggregate to use for the series query. eg: `count()`
   */
  aggregate: string;
  dataset: DiscoverDatasets;
  environment: string;
  /**
   * example: `1h`
   */
  interval: number;
  organization: Organization;
  projectId: number;
  /**
   * The filter query. eg: `span.op:http`
   */
  query: string;
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
   * Default field to use when the dataset is first selected
   */
  defaultField: QueryFieldValue;
  /**
   * Field options to display in the aggregate and field selectors
   */
  getAggregateOptions: (
    organization: Organization,
    tags?: TagCollection,
    customMeasurements?: CustomMeasurementCollection
  ) => Record<string, SelectValue<FieldValue>>;
  getSeriesQueryOptions: (options: DetectorSeriesQueryOptions) => ApiQueryKey;
  transformSeriesQueryData: (data: SeriesResponse, aggregate: string) => Series[];
}
