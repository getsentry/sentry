type HistogramDataUnit = {
  bin: number;
  count: number;
};

export type HistogramData = HistogramDataUnit[];

export type DataFilter = 'all' | 'exclude_outliers';
