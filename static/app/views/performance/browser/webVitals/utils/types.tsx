export type Row = {
  'count()': number;
  'p75(measurements.cls)': number;
  'p75(measurements.fcp)': number;
  'p75(measurements.fid)': number;
  'p75(measurements.lcp)': number;
  'p75(measurements.ttfb)': number;
  transaction: string;
  'transaction.op': string;
};

export type RowWithScore = Row & {
  clsScore: number;
  fcpScore: number;
  fidScore: number;
  lcpScore: number;
  score: number;
  ttfbScore: number;
};

export type WebVitals = 'lcp' | 'fcp' | 'cls' | 'ttfb' | 'fid';
