import type {Meta} from '../common/types';

export interface LineChartWidgetVisualizationProps {
  meta?: Meta;
}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  return <span>{props.toString()}</span>;
}
