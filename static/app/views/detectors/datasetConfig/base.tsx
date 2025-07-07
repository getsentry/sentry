import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {CustomMeasurementCollection} from 'sentry/utils/customMeasurements/customMeasurements';
import type {QueryFieldValue} from 'sentry/utils/discover/fields';
import type {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {FieldValue} from 'sentry/views/discover/table/types';

export interface DetectorSearchBarProps {
  initialQuery: string;
  onClose: (query: string, state: {validSearch: boolean}) => void;
  onSearch: (query: string) => void;
  projectIds: number[];
  dataset?: DiscoverDatasets;
}

/**
 * Minimal configuration interface for detector dataset configs.
 * Contains only the properties actually used by the detectors form.
 */
export interface DetectorDatasetConfig {
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
}
