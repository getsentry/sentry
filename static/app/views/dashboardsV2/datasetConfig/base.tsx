import {Series} from 'sentry/types/echarts';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';

export interface DatasetConfig<SeriesResponse, TableResponse> {
  /**
   * Used for mapping column fields to more desirable
   * values in tables.
   */
  fieldHeaderMap?: Record<string, string>;
  /**
   * Used to select custom renderers for field types.
   */
  getCustomFieldRenderer?: (
    field: string,
    meta: MetaType
  ) => ReturnType<typeof getFieldRenderer> | null;
  /**
   * Transforms timeseries API results into series data that is
   * ingestable by echarts for timeseries visualizations.
   */
  transformSeries?: (data: SeriesResponse) => Series[];
  /**
   * Transforms table API results into format that is used by
   * table and big number components
   */
  transformTable?: (data: TableResponse) => TableData;
}
