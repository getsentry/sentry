import {Fragment} from 'react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';

import * as Storybook from 'sentry/stories';

import {sampleLatencyHeatMap} from './fixtures/sampleLatencyHeatMap';
import {HeatMap} from './plottables/heatMap';
import {HeatMapWidgetVisualization} from './heatMapWidgetVisualization';

export default Storybook.story('HeatMapWidgetVisualization', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="HeatMapWidgetVisualization" /> is a dense data
          visualization that plots three-dimensional data by using color as the third
          axis. This naturally makes percentiles and problem areas visible, which makes it
          useful for analysis of spiky or modal data. Right now we use Heat Maps in our
          Metrics product, so the usage is limited. We expect the X-axis to be time, and
          the Z-axis (the color axis) to be a count. The Y-axis can be any continuous
          value.
        </p>

        <LargeWidget>
          <HeatMapWidgetVisualization plottables={[new HeatMap(sampleLatencyHeatMap)]} />
        </LargeWidget>
      </Fragment>
    );
  });

  story('Basic Usage', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="HeatMapWidgetVisualization" /> accepts a{' '}
          <code>plottables</code> prop, similar to{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />. At least one of the{' '}
          <code>plottables</code> must be a <code>HeatMap</code> instance.
        </p>
        <p>
          <CodeBlock language="jsx">
            {`
<HeatMapWidgetVisualization
  plottables={[new HeatMap(heatMapData)]}
/>
          `}
          </CodeBlock>
        </p>

        <p>
          The <code>HeatMap</code> class accepts a <code>HeatMapSeries</code> object.
          Here's an example of a <code>HeatMapSeries</code>:
        </p>

        <CodeBlock language="json">
          {`{
  meta: {
    xAxis: {
      name: 'time',
      start: 1777802400.0,
      end: 1777824000.0,
      bucketCount: 6,
      bucketSize: 3600,
    },
    yAxis: {
      name: 'value',
      start: 0.0,
      end: 200.0,
      bucketCount: 2,
      bucketSize: 100.0,
      valueType: 'integer',
      valueUnit: null,
    },
    zAxis: {
      name: 'count()',
      start: 0.0,
      end: 1.0,
    },
  },
  values: [
    {xAxis: 1777802400, yAxis: 0.0, zAxis: 1},
    {xAxis: 1777802400, yAxis: 100.0, zAxis: 1},
    {xAxis: 1777802400, yAxis: 200.0, zAxis: 1},
    {xAxis: 1777806000, yAxis: 0.0, zAxis: 0},
    {xAxis: 1777806000, yAxis: 100.0, zAxis: 0},
    {xAxis: 1777806000, yAxis: 200.0, zAxis: 0},
    {xAxis: 1777809600, yAxis: 0.0, zAxis: 1},
    {xAxis: 1777809600, yAxis: 100.0, zAxis: 1},
    {xAxis: 1777809600, yAxis: 200.0, zAxis: 1},
    {xAxis: 1777813200, yAxis: 0.0, zAxis: 1},
    {xAxis: 1777813200, yAxis: 100.0, zAxis: 1},
    {xAxis: 1777813200, yAxis: 200.0, zAxis: 1},
  ],
};`}
        </CodeBlock>
      </Fragment>
    );
  });
});

const LargeWidget = styled('div')`
  position: relative;
  width: 800px;
  height: 400px;
`;
