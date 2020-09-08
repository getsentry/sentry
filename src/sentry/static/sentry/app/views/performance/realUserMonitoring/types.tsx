export type HistogramData = {
  histogram: number;
  count: number;
};

export type Vital = {
  slug: string;
  name: string;
  description: string;
  failureThreshold: number;
  type: 'duration' | 'number';
};

export enum WebVital {
  FCP = 'metrics.fcp',
  LCP = 'metrics.lcp',
  FID = 'metrics.fid',
  CLS = 'metrics.cls',
}

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = {
  point1: Point;
  point2: Point;
};
