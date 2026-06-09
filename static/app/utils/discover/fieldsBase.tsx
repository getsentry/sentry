export type SortKind = 'asc' | 'desc';
export type Sort = {
  field: string;
  kind: SortKind;
};
// Contains the URL field value & the related table column width.
// Can be parsed into a Column using explodeField()
export type Field = {
  field: string;
  // When an alias is defined for a field, it will be shown as a column name in the table visualization.
  alias?: string;
  width?: number;
};
export type ParsedFunction = {
  arguments: string[];
  name: string;
};
export type AggregationRefinement = string | undefined;
export type Alignments = 'left' | 'right';
export type CountUnit = 'count';
export type PercentageUnit = 'percentage';
export type PercentChangeUnit = 'percent_change';
export enum CurrencyUnit {
  USD = 'usd',
}
export enum DurationUnit {
  NANOSECOND = 'nanosecond',
  MICROSECOND = 'microsecond',
  MILLISECOND = 'millisecond',
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
}
export enum SizeUnit {
  BIT = 'bit',
  BYTE = 'byte',
  KIBIBYTE = 'kibibyte',
  KILOBYTE = 'kilobyte',
  MEBIBYTE = 'mebibyte',
  MEGABYTE = 'megabyte',
  GIBIBYTE = 'gibibyte',
  GIGABYTE = 'gigabyte',
  TEBIBYTE = 'tebibyte',
  TERABYTE = 'terabyte',
  PEBIBYTE = 'pebibyte',
  PETABYTE = 'petabyte',
  EXBIBYTE = 'exbibyte',
  EXABYTE = 'exabyte',
}
export enum RateUnit {
  PER_SECOND = '1/second',
  PER_MINUTE = '1/minute',
  PER_HOUR = '1/hour',
}
export type DataUnit = DurationUnit | SizeUnit | RateUnit | null;
export type PlotType = 'bar' | 'line' | 'area';
