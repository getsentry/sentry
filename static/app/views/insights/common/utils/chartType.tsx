export enum ChartType {
  BAR = 0,
  LINE = 1,
  AREA = 2,
}

export function isChartType(value: any): value is ChartType {
  return typeof value === 'number' && Object.values(ChartType).includes(value as any);
}
