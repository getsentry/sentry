import React from 'react';

import {ColumnType} from 'app/utils/discover/fields';

export type HistogramData = {
  histogram: number;
  count: number;
};

export type VitalDetails = {
  slug: string;
  name: string;
  description: string;
  failureThreshold: number;
  type: ColumnType;
};

export enum Condition {
  Region = 'region',
  Browser = 'browser',
  HTTPStatus = 'http status',
  Device = 'device',
  Environment = 'environment',
  Release = 'release',
}

export type ConditionDetails = {
  icon: React.ReactNode;
  label: string;
  description: string;
  tag: string;
};

export type Point = {
  x: number;
  y: number;
};

export type Rectangle = {
  point1: Point;
  point2: Point;
};
