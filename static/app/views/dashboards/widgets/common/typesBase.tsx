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

/**
 * Right now the only kind of incompleteness reason from the backend is ingestion delay, but others are planned or possible (e.g., falling out of retention)
 */
export type IncompleteReason = 'INCOMPLETE_BUCKET';

/**
 * Shared base type for grouping information.
 * The `value` can sometimes be an array, because some datasets support array values.
 * e.g., in the error dataset, the error type could be an array that looks like `["Exception", null, "TypeError"]`
 */
type GroupBy = {
  key: string;
  value: string | number | boolean | null | Array<string | null> | Array<number | null>;
};

// Aliases - allows divergence later if unique cases arise
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

/**
 * The type of values in a categorical series.
 * This is the broadest set of types supported - any value type that can come
 * from the API. The plottable layer constrains this to plottable types.
 */
type CategoricalValueType = AttributeValueType;

/**
 * The type of a category in a categorical series.
 * Matches the possible values in a TabularRow, since the source data is from
 * the same endpoint
 */
export type CategoricalItemCategory = TabularRowValue;
export type CategoricalItemValue = number | null;

/**
 * Metadata for a categorical series.
 */
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

/**
 * The type of values in a heatmap series.
 * This is the broadest set of types supported - any value type that can come
 * from the API. The plottable layer constrains this to plottable types.
 */
type HeatMapValueType = AttributeValueType;
export type HeatMapValueUnit = AttributeValueUnit;

/**
 * A single item in a heat map series.
 */
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

/**
 * Metadata for a heat map series X-axis. Right now this axis is always time.
 */
interface HeatMapSeriesXAxisMeta extends NamedMeta, BoundedMeta, BucketedMeta {}

/**
 * Metadata for a heat map series Y axis. Right now this is the only axis that is configurable by the user, so it returns the value type and unit.
 */
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

/**
 * Metadata for a heat map series Z axis. Right now this is always a count.
 */
interface HeatMapSeriesZAxisMeta extends NamedMeta, BoundedMeta {}

/**
 * Metadata for a heat map series.
 */
interface HeatMapSeriesMeta {
  xAxis: HeatMapSeriesXAxisMeta;
  yAxis: HeatMapSeriesYAxisMeta;
  zAxis: HeatMapSeriesZAxisMeta;
}

/**
 * A heat map data series for heat map visualizations.
 */
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
