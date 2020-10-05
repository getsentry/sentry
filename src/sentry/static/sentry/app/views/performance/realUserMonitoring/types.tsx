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
  FP = 'measurements.fp',
  FCP = 'measurements.fcp',
  LCP = 'measurements.lcp',
  FID = 'measurements.fid',
}

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = {
  point1: Point;
  point2: Point;
};
