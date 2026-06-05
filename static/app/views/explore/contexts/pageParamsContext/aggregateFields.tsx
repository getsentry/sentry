import {Visualize} from './visualizes';

export interface GroupBy {
  groupBy: string;
}

export function isGroupBy(value: any): value is GroupBy {
  return value != null && typeof value === 'object' && typeof value.groupBy === 'string';
}

export function isVisualize(value: any): value is Visualize {
  return (
    value != null &&
    typeof value === 'object' &&
    'yAxis' in value &&
    typeof value.yAxis === 'string'
  );
}
