import {action} from '@storybook/addon-actions';

import ChartZoom from 'sentry/components/charts/chartZoom';
import LineChart from 'sentry/components/charts/lineChart';

export default {
  title: 'Components/Data Visualization/Charts/Utilities/Chart Zoom',
  component: ChartZoom,
  args: {
    height: 300,
    grid: {
      top: 40,
      bottom: 20,
      left: '10%',
      right: '10%',
      containLabel: true,
    },
    legend: {
      data: ['sentry:user', 'environment', 'browser'],
      type: 'scroll',
    },
  },
};

export const _ChartZoom = ({grid, legend, height}) => (
  <div style={{backgroundColor: 'white', padding: 12}}>
    <ChartZoom onZoom={action('ChartZoom.onZoom')}>
      {zoomRenderProps => (
        <LineChart
          tooltip={{
            filter: value => value !== null,
            truncate: 80,
          }}
          {...zoomRenderProps}
          legend={legend}
          height={height}
          grid={grid}
          series={[
            {
              seriesName: 'sentry:user',
              data: [
                {value: 18, name: 1531094400000},
                {value: 31, name: 1531180800000},
                {value: 9, name: 1532070000000},
                {value: 100, name: 1532156400000},
                {value: 12, name: 1532242800000},
              ],
            },
            {
              seriesName: 'environment',
              data: [
                {value: 84, name: 1531094400000},
                {value: 1, name: 1531180800000},
                {value: 28, name: 1532070000000},
                {value: 1, name: 1532156400000},
                {value: 1, name: 1532242800000},
              ],
            },
            {
              seriesName: 'browser',
              data: [
                {value: 108, name: 1531094400000},
                {value: 1, name: 1531180800000},
                {value: 36, name: 1532070000000},
                {value: 0, name: 1532156400000},
                {value: 1, name: 1532242800000},
              ],
            },
          ]}
        />
      )}
    </ChartZoom>
  </div>
);
_ChartZoom.storyName = 'Chart Zoom';
_ChartZoom.parameters = {
  docs: {
    description: {
      story: `This is a strongly opinionated component that takes a render prop through "children".
      It requires the Global Selection Header and will update the date range selector when zooming. It also
      has specific behavior to control when the component should update, as well as opinions for
      the time interval to use.`,
    },
  },
};
