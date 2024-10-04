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
