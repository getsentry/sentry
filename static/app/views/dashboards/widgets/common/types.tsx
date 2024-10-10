export type Meta = {
  fields: Record<string, string>;
  units?: Record<string, string | null>;
};

type TableRow = Record<string, number | string | undefined>;
export type TableData = TableRow[];

export interface DataProps {
  data?: TableData;
  previousPeriodData?: TableData;
}

export type ErrorProp = Error | string;

export interface StateProps {
  error?: ErrorProp;
  isLoading?: boolean;
  onRetry?: () => void;
}

export type MaxValues = {
  max1: number;
  max2: number;
};

// `max_values` is Snake Case to preserve compatibility with the current widget serializer. We _do_ want to change it to Camel Case!
export interface Thresholds {
  max_values: MaxValues;
  unit: string;
}
