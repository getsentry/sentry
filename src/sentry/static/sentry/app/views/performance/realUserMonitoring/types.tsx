import {ColumnType} from 'app/utils/discover/fields';

export type HistogramData = {
  histogram: number;
  count: number;
};

export type Vital = {
  slug: string;
  name: string;
  description: string;
  failureThreshold: number;
  type: ColumnType;
};

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = {
  point1: Point;
  point2: Point;
};
