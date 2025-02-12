import type {Confidence} from 'sentry/types/organization';

import type {ThresholdsConfig} from '../../widgetBuilder/buildSteps/thresholdsStep/thresholdsStep';

export type Meta = {
  fields: Record<string, string | null>;
  units: Record<string, string | null>;
};

type TableRow = Record<string, number | string | undefined>;
export type TableData = TableRow[];

export type TimeSeriesItem = {
  timestamp: string;
  value: number | null;
  delayed?: boolean;
};

export type TimeSeries = {
  data: TimeSeriesItem[];
  field: string;
  meta: Meta;
  color?: string;
  confidence?: Confidence;
};

export type ErrorProp = Error | string;

export interface StateProps {
  error?: ErrorProp;
  isLoading?: boolean;
  onRetry?: () => void;
}

export type Thresholds = ThresholdsConfig;

export type Release = {
  timestamp: string;
  version: string;
};

export type Aliases = Record<string, string>;

export type TimeseriesSelection = {[key: string]: boolean};
