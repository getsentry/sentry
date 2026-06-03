import {Fragment, useState} from 'react';
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
        <p>
          <strong>Hint:</strong> clicking on the chart will display the x-, y-, and z-axis
          values in the tooltip.
        </p>
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

  story('Tooltip Options', () => {
    function TooltipOptionsStory() {
      const [localFilterQuery, setLocalFilterQuery] = useState<string | undefined>(
        undefined
      );
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="HeatMapWidgetVisualization" /> supports two optional
            tooltip action props. Click a cell to open the tooltip and see the links.
          </p>
          <p>
            With no extra props, the tooltip shows the Y-axis bucket range and the Z-axis
            count for the clicked cell.
          </p>
          <p>
            Pass <code>makeExploreUrl</code> to add a <em>View connected spans</em> link
            in the tooltip. The callback receives the Y-axis filter query (e.g.{' '}
            <code>value:&gt;=200 value:&lt;250</code>) and a <code>PageFilters</code>{' '}
            object whose datetime is narrowed to the clicked X-axis bucket. Use these to
            build a cross-event query link into Explore.
          </p>
          <p>
            <CodeBlock language="jsx">
              {`<HeatMapWidgetVisualization
  plottables={[new HeatMap(heatMapData)]}
  makeExploreUrl={(query, filteredSelection) =>
    getExploreUrl({
      organization,
      selection: filteredSelection,
      crossEvents: [{
            type: 'metrics',
            metric,
            query,
      }]
    })
  }
/>`}
            </CodeBlock>
          </p>

          <p>
            Pass <code>updateLocalFilterQuery</code> to add an <em>Add to filter</em> link
            in the tooltip. The callback receives the Y-axis filter query and should apply
            that filter to the current view. Navigation is handled however you choose in
            the passing function (most likely will use hooks).
          </p>
          <p>
            <CodeBlock language="jsx">
              {`<HeatMapWidgetVisualization
  plottables={[new HeatMap(heatMapData)]}
  updateLocalFilterQuery={(query) =>
    setLocalFilterQuery(query)
  }
/>`}
            </CodeBlock>
          </p>

          <p>
            Both props can be used together. The tooltip shows{' '}
            <em>View related traces</em> and <em>Add to filter</em> as separate actions.
          </p>
          <LargeWidget>
            <p>{`Local Filter Query: ${localFilterQuery}`}</p>
            <HeatMapWidgetVisualization
              plottables={[new HeatMap(sampleLatencyHeatMap)]}
              makeExploreUrl={(query, filteredSelection) =>
                `/explore/traces/?query=${encodeURIComponent(query)}&start=${filteredSelection.datetime.start}&end=${filteredSelection.datetime.end}`
              }
              updateLocalFilterQuery={query => setLocalFilterQuery(query)}
            />
          </LargeWidget>
        </Fragment>
      );
    }
    return <TooltipOptionsStory />;
  });
});

const LargeWidget = styled('div')`
  position: relative;
  width: 800px;
  height: 400px;
`;
