export type Row = {
  'count()': number;
  'p75(measurements.app_init_long_tasks)': number;
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.lcp)': number;
  transaction: string;
  'transaction.op': string;
};

export type RowWithScore = Row & {score: number};

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'tbt';
