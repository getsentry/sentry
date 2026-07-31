export type ChartAxis = 'time' | 'category';

export type ChartUnit = 'number' | 'percentage' | 'duration' | 'bytes';

export interface ChartPoint {
  name: string | number;
  value: number;
}

export interface ChartSeries {
  data: ChartPoint[];
  seriesName: string;
}
