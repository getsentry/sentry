<<<<<<< HEAD:src/sentry/static/sentry/app/components/charts/components/markPoint.jsx
=======
import {EChartOption} from 'echarts';

/**
 * eCharts markPoint
 *
 * See https://ecomfe.github.io/echarts-doc/public/en/option.html#series-line.markPoint
 */
export default function MarkPoint(
  props: EChartOption.SeriesLine['markPoint']
): EChartOption.SeriesLine['markPoint'] {
  return {
    ...props,
  };
}
