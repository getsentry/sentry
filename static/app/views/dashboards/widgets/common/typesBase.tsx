import type {DataUnit} from 'sentry/utils/discover/fieldsBase';

type AttributeValueType =
  | 'number'
  | 'integer'
  | 'date'
  | 'boolean'
  | 'duration'
  | 'percentage'
  | 'percent_change'
  | 'string'
  | 'size'
  | 'rate'
  | 'score'
  | 'currency';
type AttributeValueUnit = DataUnit | null;
export type TimeSeriesValueType = AttributeValueType;
export type TimeSeriesValueUnit = AttributeValueUnit;
export type IncompleteReason = 'INCOMPLETE_BUCKET';
type GroupBy = {
  key: string;
  value: string | number | boolean | null | Array<string | null> | Array<number | null>;
};
export type TimeSeriesGroupBy = GroupBy;
export type CategoricalGroupBy = GroupBy;
export type TabularValueType = AttributeValueType | null;
export type TabularValueUnit = AttributeValueUnit;
export type TabularMeta<TFields extends string = string> = {
  fields: Record<TFields, TabularValueType>;
  units: Record<TFields, TabularValueUnit>;
};
type TabularRowValue = number | string | string[] | boolean | null;
export type TabularRow<TFields extends string = string> = Record<
  TFields,
  TabularRowValue
>;
export type TabularData<TFields extends string = string> = {
  data: Array<TabularRow<TFields>>;
  meta: TabularMeta<TFields>;
};
export type TabularColumn<TFields extends string = string> = {
  key: TFields;
  sortable?: boolean;
  type?: TabularValueType;
  width?: number;
};
type ErrorProp = Error | string;
export interface ErrorPropWithResponseJSON extends Error {
  responseJSON?: {detail: string};
}
export interface StateProps {
  error?: ErrorProp | ErrorPropWithResponseJSON;
  isLoading?: boolean;
  onRetry?: () => void;
}
export type Release = {
  timestamp: string;
  version: string;
};
export type LegendSelection = Record<string, boolean>;
type CategoricalValueType = AttributeValueType;
export type CategoricalItemCategory = TabularRowValue;
export type CategoricalItemValue = number | null;
export interface CategoricalSeriesMeta {
  /**
   * The type of the values (e.g., "duration", "number")
   */
  valueType: CategoricalValueType;
  /**
   * The unit of the values, if applicable.
   */
  valueUnit: DataUnit | null;
}
type HeatMapValueType = AttributeValueType;
export type HeatMapValueUnit = AttributeValueUnit;
interface HeatMapItem {
  /**
   * The X-axis value
   */
  xAxis: number;
  /**
   * The Y-axis value
   */
  yAxis: number;
  /**
   * The Z-axis value. This can be null if the value is missing.
   */
  zAxis: number | null;
}
interface BoundedMeta {
  /**
   * The largest value of data on the axis
   */
  end: number;
  /**
   * The name of the series. Corresponds to what it's plotting. Could be `"time"` or something like `"count()"`
   */
  name: string;
  /**
   * The smallest value of data on the axis
   */
  start: number;
}
interface BucketedMeta {
  /**
   * The total count of buckets on this axis. Matches what was requested, if were requested
   */
  bucketCount: number;
  /**
   * The size of the buckets on this axis.
   */
  bucketSize: number;
}
interface NamedMeta {
  /**
   * The name of the series. Corresponds to what it's plotting. Could be `"time"` or something like `"count()"`
   */
  name: string;
}
interface HeatMapSeriesXAxisMeta extends NamedMeta, BoundedMeta, BucketedMeta {}
interface HeatMapSeriesYAxisMeta extends NamedMeta, BoundedMeta, BucketedMeta {
  /**
   * The type of the values (e.g., "duration", "number")
   */
  valueType: HeatMapValueType;
  /**
   * The unit of the values, if applicable.
   */
  valueUnit: DataUnit | null;
}
interface HeatMapSeriesZAxisMeta extends NamedMeta, BoundedMeta {}
interface HeatMapSeriesMeta {
  xAxis: HeatMapSeriesXAxisMeta;
  yAxis: HeatMapSeriesYAxisMeta;
  zAxis: HeatMapSeriesZAxisMeta;
}
export interface HeatMapSeries {
  /**
   * Metadata about the series.
   */
  meta: HeatMapSeriesMeta;
  /**
   * The data points in this series.
   */
  values: HeatMapItem[];
  /**
   * Represents the grouping information for the series, if applicable.
   */
  groupBy?: CategoricalGroupBy[] | null;
}
