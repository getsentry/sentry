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
          useful for analysis of spiky or modal data. Right now we use Heatmaps in our
          Metrics product, so the usage is limited. We expect the X-axis to be time, and
          the Z-axis (the color axis) to be a count. The Y-axis can be any continuous
          value.
        </p>

        <LargeWidget>
          <HeatMapWidgetVisualization plottables={[new HeatMap(sampleLatencyHeatMap)]} />
        </LargeWidget>

        <p>
          <strong>Hint:</strong> clicking on the chart will display the X-, Y-, and Z-axis
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

  story('Tooltip Actions', () => {
    function TooltipActionsStory() {
      const [localFilterQuery, setLocalFilterQuery] = useState<string | undefined>(
        undefined
      );

      return (
        <Fragment>
          <p>
            By default a cell's tooltip shows its Y-axis bucket range and Z-axis count.
            Click a cell to open the tooltip.
          </p>
          <p>
            Pass <code>renderTooltipActions</code> to add action rows (e.g., an Explore
            link). It receives the hovered cell's raw bounds — <code>valueMin</code>/
            <code>valueMax</code> (Y-axis) and <code>timestampStart</code>/
            <code>timestampEnd</code> (X-axis). It should return a React fragment that
            will be rendered in the tooltip.
          </p>
          <p>
            Because ECharts renders the tooltip to an HTML string, React click handlers
            don't work in that context. Instead, the visualization routes clicks for you.
            Annotate your links with <code>data-traces-link</code> for navigations, and{' '}
            <code>data-tooltip-action</code> with <code>data-tooltip-action-value</code>{' '}
            for actions. These will be dispatched to the matching{' '}
            <code>tooltipActionHandlers</code> entry.
          </p>
          <p>
            <CodeBlock language="jsx">
              {`<HeatMapWidgetVisualization
  plottables={[new HeatMap(heatMapData)]}
  tooltipActionHandlers={{'add-to-filter': query => setLocalFilterQuery(query)}}
  renderTooltipActions={({valueMin, valueMax, timestampStart, timestampEnd}) => {
    const valueQuery = \`value:>=\${valueMin} value:<\${valueMax}\`;
    return (
      <Fragment>
        <a data-traces-link={getExploreUrl({organization, selection, crossEvents: [...]})}>
          View connected spans
        </a>
        <a data-tooltip-action="add-to-filter" data-tooltip-action-value={valueQuery}>
          Add to filter
        </a>
      </Fragment>
    );
  }}
/>`}
            </CodeBlock>
          </p>
          <LargeWidget>
            <p>{`Local Filter Query: ${localFilterQuery}`}</p>
            <HeatMapWidgetVisualization
              plottables={[new HeatMap(sampleLatencyHeatMap)]}
              tooltipActionHandlers={{
                'add-to-filter': query => setLocalFilterQuery(query),
              }}
              renderTooltipActions={({valueMin, valueMax}) => (
                <div>
                  <span className="tooltip-label tooltip-label-centered">
                    <a
                      data-tooltip-action="add-to-filter"
                      data-tooltip-action-value={`value:>=${valueMin} value:<${valueMax}`}
                    >
                      Add to filter
                    </a>
                  </span>
                </div>
              )}
            />
          </LargeWidget>
        </Fragment>
      );
    }
    return <TooltipActionsStory />;
  });
});

const LargeWidget = styled('div')`
  position: relative;
  width: 800px;
  height: 400px;
`;
