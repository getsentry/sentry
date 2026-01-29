import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/views/dashboards/widgets/barChartWidgetVisualization/barChartWidgetVisualization';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CodeBlock} from 'sentry/components/core/code';
import * as Storybook from 'sentry/stories';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';

import {
  sampleCountCategoricalData,
  sampleDurationCategoricalData,
  sampleLargeValueData,
  sampleLongLabelData,
  sampleManyCategoriesData,
  sampleMultiSeriesData,
  sampleNegativeData,
  samplePercentageData,
  sampleRateData,
  sampleSizeData,
  sampleSparseData,
  sampleStackedCategoricalData,
} from './fixtures/sampleCountCategoricalData';
import {Bars} from './plottables/bar';
import {BarChartWidgetVisualization} from './barChartWidgetVisualization';

export default Storybook.story('BarChartWidgetVisualization', (story, APIReference) => {
  APIReference(documentation.props?.BarChartWidgetVisualization);

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> is a categorical bar
          chart component, designed to plot discrete category data. Unlike{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />, this component uses
          category labels on one axis rather than timestamps. It includes features like:
        </p>

        <ul>
          <li>configurable orientation (vertical or horizontal bars)</li>
          <li>stacked bar support</li>
          <li>automatic Y-axis formatting based on data types</li>
          <li>legend and tooltip support</li>
          <li>
            skipping <code>null</code> values while plotting
          </li>
        </ul>

        <Storybook.SideBySide>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[new Bars(sampleCountCategoricalData)]}
            />
          </SmallWidget>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[new Bars(sampleDurationCategoricalData)]}
            />
          </SmallWidget>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[new Bars(sampleCountCategoricalData)]}
              orientation="horizontal"
            />
          </SmallWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Basic Usage', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> accepts the{' '}
          <code>plottables</code> prop, similar to{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />. Each item in the{' '}
          <code>plottables</code> array must implement the{' '}
          <code>CategoricalBarChartPlottable</code> interface. The <code>Bar</code> class
          is provided for this purpose.
        </p>

        <CodeBlock language="jsx">
          {`
<BarChartWidgetVisualization
  plottables={[new Bar(categoricalSeries)]}
/>
          `}
        </CodeBlock>

        <p>
          The <code>Bar</code> class accepts a <code>CategoricalSeries</code> object and
          an optional configuration object. Here's an example of a{' '}
          <code>CategoricalSeries</code>:
        </p>

        <CodeBlock language="json">
          {`{
  "valueAxis": "count()",
  "meta": {
    "valueType": "integer",
    "valueUnit": null
  },
  "data": [
    {"label": "Chrome", "value": 1250},
    {"label": "Firefox", "value": 890},
    {"label": "Safari", "value": 650}
  ]
}`}
        </CodeBlock>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleCountCategoricalData)]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Orientation', () => {
    return (
      <Fragment>
        <p>
          The <code>orientation</code> prop controls whether bars are displayed vertically
          or horizontally. The default is <code>"vertical"</code>.
        </p>

        <p>Vertical (default)</p>
        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleCountCategoricalData)]}
            orientation="vertical"
          />
        </MediumWidget>

        <p>Horizontal</p>
        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleCountCategoricalData)]}
            orientation="horizontal"
          />
        </MediumWidget>

        <p>
          Horizontal bars are particularly useful when you have long category labels or
          many categories:
        </p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleDurationCategoricalData)]}
            orientation="horizontal"
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Stacking', () => {
    return (
      <Fragment>
        <p>
          Bar plottables support stacking via the <code>stack</code> configuration option.
          Bars with the same stack name will be stacked together.
        </p>

        <CodeBlock language="jsx">
          {`
<BarChartWidgetVisualization
  plottables={[
    new Bar(successSeries, {stack: 'all'}),
    new Bar(errorSeries, {stack: 'all'})
  ]}
/>`}
        </CodeBlock>

        <Storybook.SideBySide>
          <MediumWidget>
            <p>Unstacked (default)</p>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleStackedCategoricalData[0]!),
                new Bars(sampleStackedCategoricalData[1]!),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <p>Stacked</p>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleStackedCategoricalData[0]!, {stack: 'all'}),
                new Bars(sampleStackedCategoricalData[1]!, {stack: 'all'}),
              ]}
            />
          </MediumWidget>
        </Storybook.SideBySide>

        <p>Stacking also works with horizontal orientation:</p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[
              new Bars(sampleStackedCategoricalData[0]!, {stack: 'all'}),
              new Bars(sampleStackedCategoricalData[1]!, {stack: 'all'}),
            ]}
            orientation="horizontal"
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Data Types', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> supports the same data
          types as <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />:
        </p>

        <ul>
          <li>
            <code>number</code>
          </li>
          <li>
            <code>integer</code>
          </li>
          <li>
            <code>duration</code>
          </li>
          <li>
            <code>percentage</code>
          </li>
          <li>
            <code>size</code>
          </li>
          <li>
            <code>rate</code>
          </li>
        </ul>

        <p>
          The axis formatting automatically adjusts based on the data type. Below is an
          example with duration data:
        </p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleDurationCategoricalData)]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('X Axis', () => {
    return (
      <Fragment>
        <p>
          In a <Storybook.JSXNode name="BarChartWidgetVisualization" />, the X axis
          displays category labels. The labels are automatically truncated when they are
          too long to fit. For long labels, consider using horizontal orientation to give
          more room for the text.
        </p>

        <p>Short labels (vertical):</p>
        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleCountCategoricalData)]}
          />
        </MediumWidget>

        <p>
          Long labels get truncated in vertical orientation. Notice how the endpoint paths
          are cut off:
        </p>
        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleLongLabelData)]} />
        </MediumWidget>

        <p>
          Horizontal orientation gives more room for long labels, making them fully
          readable:
        </p>
        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleLongLabelData)]}
            orientation="horizontal"
          />
        </MediumWidget>

        <p>
          When you have many categories, the chart will scale to fit them. With 12
          categories in vertical orientation, the bars become narrower:
        </p>
        <LargeWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleManyCategoriesData)]}
          />
        </LargeWidget>

        <p>
          Horizontal orientation with many categories works well when you have vertical
          space:
        </p>
        <TallWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleManyCategoriesData)]}
            orientation="horizontal"
          />
        </TallWidget>
      </Fragment>
    );
  });

  story('Y Axis', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> automatically formats
          the Y axis based on the data type and unit. The logic is similar to{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />:
        </p>

        <ul>
          <li>Look through all plottables and determine their data types</li>
          <li>Use the most common type for Y axis formatting</li>
          <li>Format values using appropriate units (ms, KB, /s, %, etc.)</li>
        </ul>

        <p>Percentage data (values between 0 and 1, displayed as percentages):</p>
        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(samplePercentageData)]} />
        </MediumWidget>

        <p>Size data (bytes, automatically scaled to KB, MB, etc.):</p>
        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleSizeData)]} />
        </MediumWidget>

        <p>Rate data (requests per second):</p>
        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleRateData)]} />
        </MediumWidget>

        <p>
          Large values are automatically formatted with K, M, B suffixes for readability:
        </p>
        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleLargeValueData)]} />
        </MediumWidget>

        <p>
          When combining series with different data types (e.g., count and duration), the
          chart uses the most common type for the Y axis:
        </p>
        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[
              new Bars(sampleCountCategoricalData, {alias: 'Count'}),
              new Bars(sampleDurationCategoricalData, {alias: 'Duration'}),
            ]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Color', () => {
    const theme = useTheme();

    return (
      <Fragment>
        <p>
          You can control the color of each bar plottable by setting the{' '}
          <code>color</code> configuration option:
        </p>

        <Storybook.SideBySide>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleCountCategoricalData, {
                  color: theme.tokens.content.danger,
                }),
              ]}
            />
          </SmallWidget>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleCountCategoricalData, {
                  color: theme.tokens.content.success,
                }),
              ]}
            />
          </SmallWidget>
          <SmallWidget>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleStackedCategoricalData[0]!, {
                  stack: 'all',
                  color: theme.tokens.content.success,
                }),
                new Bars(sampleStackedCategoricalData[1]!, {
                  stack: 'all',
                  color: theme.tokens.content.danger,
                }),
              ]}
            />
          </SmallWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Legends', () => {
    const [legendSelection, setLegendSelection] = useState<LegendSelection>({});

    return (
      <Fragment>
        <p>
          By default, a legend is shown when there are multiple plottables. You can
          control legend visibility with the <code>showLegend</code> prop:
        </p>

        <ul>
          <li>
            <code>"auto"</code> (default): Show legend if there are multiple series
          </li>
          <li>
            <code>"never"</code>: Never show the legend
          </li>
          <li>
            <code>"always"</code>: Always show the legend
          </li>
        </ul>

        <p>
          Use <code>legendSelection</code> and <code>onLegendSelectionChange</code> to
          control which series are visible:
        </p>

        <code>{JSON.stringify(legendSelection)}</code>

        <Storybook.SideBySide>
          <MediumWidget>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleStackedCategoricalData[0]!, {alias: 'Success'}),
                new Bars(sampleStackedCategoricalData[1]!, {alias: 'Error'}),
              ]}
              legendSelection={legendSelection}
              onLegendSelectionChange={setLegendSelection}
            />
          </MediumWidget>
          <MediumWidget>
            <BarChartWidgetVisualization
              plottables={[
                new Bars(sampleCountCategoricalData, {alias: 'Browser Count'}),
              ]}
              showLegend="always"
            />
          </MediumWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Click Events', () => {
    const [clickedItem, setClickedItem] = useState<string | null>(null);

    return (
      <Fragment>
        <p>
          You can respond to bar click events by passing the <code>onClick</code>{' '}
          configuration option to the <code>Bar</code> plottable:
        </p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[
              new Bars(sampleCountCategoricalData, {
                onClick: item => {
                  setClickedItem(`${item.category}: ${item.value}`);
                },
              }),
            ]}
          />

          <p>Clicked: {clickedItem ?? 'None'}</p>
        </MediumWidget>
      </Fragment>
    );
  });

  story('Null and Missing Values', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> gracefully handles{' '}
          <code>null</code> values in the data. Bars with null values are simply not
          rendered, leaving a gap in that position.
        </p>

        <p>
          In the example below, February and April have <code>null</code> values:
        </p>

        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleSparseData)]} />
        </MediumWidget>

        <p>Same data with horizontal orientation:</p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleSparseData)]}
            orientation="horizontal"
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Negative Values', () => {
    return (
      <Fragment>
        <p>
          Bar charts can display negative values, which is useful for showing
          deltas/changes, comparisons, or any data that can go below zero. Bars extend
          downward (or leftward in horizontal mode) from the zero line.
        </p>

        <MediumWidget>
          <BarChartWidgetVisualization plottables={[new Bars(sampleNegativeData)]} />
        </MediumWidget>

        <p>Horizontal orientation with negative values:</p>

        <MediumWidget>
          <BarChartWidgetVisualization
            plottables={[new Bars(sampleNegativeData)]}
            orientation="horizontal"
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Many Series', () => {
    return (
      <Fragment>
        <p>
          When you have multiple plottables without explicit colors, the chart
          automatically assigns colors from the theme's color palette. This ensures visual
          distinction between series.
        </p>

        <LargeWidget>
          <BarChartWidgetVisualization
            plottables={sampleMultiSeriesData.map(series => new Bars(series))}
          />
        </LargeWidget>

        <p>Stacked version with many series:</p>

        <LargeWidget>
          <BarChartWidgetVisualization
            plottables={sampleMultiSeriesData.map(
              series => new Bars(series, {stack: 'browsers'})
            )}
          />
        </LargeWidget>

        <p>Horizontal stacked version:</p>

        <TallWidget>
          <BarChartWidgetVisualization
            plottables={sampleMultiSeriesData.map(
              series => new Bars(series, {stack: 'browsers'})
            )}
            orientation="horizontal"
          />
        </TallWidget>
      </Fragment>
    );
  });

  story('Loading Placeholder', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="BarChartWidgetVisualization" /> includes a loading
          placeholder. You can use it via{' '}
          <Storybook.JSXNode name="BarChartWidgetVisualization.LoadingPlaceholder" />
        </p>

        <SmallWidget>
          <BarChartWidgetVisualization.LoadingPlaceholder />
        </SmallWidget>
      </Fragment>
    );
  });
});

const SmallWidget = styled('div')`
  position: relative;
  width: 360px;
  height: 160px;
`;

const MediumWidget = styled('div')`
  position: relative;
  width: 420px;
  height: 250px;
`;

const LargeWidget = styled('div')`
  position: relative;
  width: 600px;
  height: 300px;
`;

const TallWidget = styled('div')`
  position: relative;
  width: 420px;
  height: 400px;
`;
