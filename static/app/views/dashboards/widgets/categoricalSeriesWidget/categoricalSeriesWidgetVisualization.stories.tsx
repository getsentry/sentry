import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/views/dashboards/widgets/categoricalSeriesWidget/categoricalSeriesWidgetVisualization';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CodeBlock} from '@sentry/scraps/code';
import {Heading} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import type {LegendSelection} from 'sentry/views/dashboards/widgets/common/types';

import {sampleManyCommonAffixData} from './fixtures/commonAffixCategorical';
import {sampleCountCategoricalData} from './fixtures/countCategorical';
import {sampleDurationCategoricalData} from './fixtures/durationCategorical';
import {sampleLargeValueData} from './fixtures/largeValueCategorical';
import {sampleLongLabelData} from './fixtures/longLabelCategorical';
import {sampleManyCategoriesData} from './fixtures/manyCategoriesCategorical';
import {sampleMultiSeriesData} from './fixtures/multiSeriesCategorical';
import {sampleNegativeData} from './fixtures/negativeCategorical';
import {samplePercentageData} from './fixtures/percentageCategorical';
import {sampleRateData} from './fixtures/rateCategorical';
import {sampleSizeData} from './fixtures/sizeCategorical';
import {sampleSparseData} from './fixtures/sparseCategorical';
import {sampleStackedCategoricalData} from './fixtures/stackedCategorical';
import {Bars} from './plottables/bars';
import {CategoricalSeriesWidgetVisualization} from './categoricalSeriesWidgetVisualization';

export default Storybook.story(
  'CategoricalSeriesWidgetVisualization',
  (story, APIReference) => {
    APIReference(documentation.props?.CategoricalSeriesWidgetVisualization);

    story('Getting Started', () => {
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" /> is a
            categorical chart component, designed to plot discrete category data. Unlike{' '}
            <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />, this component
            uses category labels on the X-axis rather than timestamps. It includes
            features like:
          </p>

          <ul>
            <li>Automatic Y-axis formatting based on data types</li>
            <li>Legend and tooltip support</li>
            <li>
              Skipping <code>null</code> values while plotting
            </li>
            <li>Label truncation and rotation</li>
          </ul>

          <SmallWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleCountCategoricalData)]}
            />
          </SmallWidget>
        </Fragment>
      );
    });

    story('Basic Usage', () => {
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" /> accepts the{' '}
            <code>plottables</code> prop, similar to{' '}
            <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />. Each item in the{' '}
            <code>plottables</code> array must implement the{' '}
            <code>CategoricalPlottable</code> interface. Right now the only supported
            prottable is <code>Bars</code>.
          </p>

          <CodeBlock language="jsx">
            {`
<CategoricalSeriesWidgetVisualization
  plottables={[new Bars(categoricalSeries)]}
/>
          `}
          </CodeBlock>

          <p>
            The <code>Bars</code> class accepts a <code>CategoricalSeries</code> object
            and an optional configuration object. Here's an example of a{' '}
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
    {category: "Chrome", value: 1250},
    {category: "Firefox", value: 890},
    {category: "Safari", value: 650},
    {category: "Edge", value: 420},
    {category: "Opera", value: 180},
  ]
}`}
          </CodeBlock>

          <div>
            <MediumWidget>
              <CategoricalSeriesWidgetVisualization
                plottables={[new Bars(sampleCountCategoricalData)]}
              />
            </MediumWidget>
          </div>
        </Fragment>
      );
    });

    story('Stacking', () => {
      return (
        <Fragment>
          <p>
            <code>Bars</code> plottables support stacking via the <code>stack</code>{' '}
            configuration option. Bars with the same stack name will be stacked together.
          </p>

          <CodeBlock language="jsx">
            {`
<CategoricalSeriesWidgetVisualization
  plottables={[
    new Bars(successSeries, {stack: 'all'}),
    new Bars(errorSeries, {stack: 'all'})
  ]}
/>`}
          </CodeBlock>

          <Storybook.SideBySide>
            <MediumWidget>
              <Heading as="h3">Unstacked</Heading>
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleStackedCategoricalData[0]),
                  new Bars(sampleStackedCategoricalData[1]),
                ]}
              />
            </MediumWidget>
            <MediumWidget>
              <Heading as="h3">Stacked</Heading>
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleStackedCategoricalData[0], {stack: 'all'}),
                  new Bars(sampleStackedCategoricalData[1], {stack: 'all'}),
                ]}
              />
            </MediumWidget>
          </Storybook.SideBySide>
        </Fragment>
      );
    });

    story('Data Types', () => {
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" /> supports the
            same data types as <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />:
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
            <CategoricalSeriesWidgetVisualization
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
            In a <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" />, the X
            axis displays category labels. Labels will be truncated and rotated
            intelligently to fit.
          </p>
          <Heading as="h3">Short Labels</Heading>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleCountCategoricalData)]}
            />
          </MediumWidget>
          <Heading as="h3">Common Affix Truncation</Heading>
          <p>
            Common suffixes and prefixed will be truncated automatically if needed. e.g.,
            the categories <code>"/api/issues"</code> and <code>"/api/errors"</code> will
            turn into<code>"issues"</code> and <code>"errors"</code> to save space.{' '}
          </p>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleLongLabelData)]}
            />
          </MediumWidget>
          <Heading as="h3">Rotation</Heading>
          <p>Labels are rotated when there are more than 10 categories.</p>
          <LargeWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleManyCategoriesData)]}
            />
          </LargeWidget>

          <Heading as="h3">Affix Truncation and Rotation</Heading>
          <p>
            When there are many categories that share a common prefix, both affix
            truncation and rotation are applied together.
          </p>
          <LargeWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleManyCommonAffixData)]}
            />
          </LargeWidget>
        </Fragment>
      );
    });

    story('Y Axis', () => {
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" />{' '}
            automatically formats the Y axis based on the data type and unit. The logic is
            similar to <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />:
          </p>

          <ul>
            <li>Use the data type from the first plottable for Y axis formatting</li>
            <li>Format values using appropriate units (ms, KB, /s, %, etc.)</li>
          </ul>

          <p>Percentage data (values between 0 and 1, displayed as percentages):</p>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(samplePercentageData)]}
            />
          </MediumWidget>

          <p>Size data (bytes, automatically scaled to KB, MB, etc.):</p>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleSizeData)]}
            />
          </MediumWidget>

          <p>Rate data (requests per second):</p>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleRateData)]}
            />
          </MediumWidget>

          <p>
            Large values are automatically formatted with K, M, B suffixes for
            readability:
          </p>
          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleLargeValueData)]}
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
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleCountCategoricalData, {
                    color: theme.tokens.content.danger,
                  }),
                ]}
              />
            </SmallWidget>
            <SmallWidget>
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleCountCategoricalData, {
                    color: theme.tokens.content.success,
                  }),
                ]}
              />
            </SmallWidget>
            <SmallWidget>
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleStackedCategoricalData[0], {
                    stack: 'all',
                    color: theme.tokens.content.success,
                  }),
                  new Bars(sampleStackedCategoricalData[1], {
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
              <CategoricalSeriesWidgetVisualization
                plottables={[
                  new Bars(sampleStackedCategoricalData[0], {alias: 'Success'}),
                  new Bars(sampleStackedCategoricalData[1], {alias: 'Error'}),
                ]}
                legendSelection={legendSelection}
                onLegendSelectionChange={setLegendSelection}
              />
            </MediumWidget>
            <MediumWidget>
              <CategoricalSeriesWidgetVisualization
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
            <CategoricalSeriesWidgetVisualization
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
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" /> gracefully
            handles <code>null</code> values in the data. Bars with null values are simply
            not rendered, leaving a gap in that position.
          </p>

          <p>
            In the example below, February and April have <code>null</code> values:
          </p>

          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleSparseData)]}
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
            downward from the zero line.
          </p>

          <MediumWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={[new Bars(sampleNegativeData)]}
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
            automatically assigns colors from the theme's color palette. This ensures
            visual distinction between series.
          </p>

          <LargeWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={sampleMultiSeriesData.map(series => new Bars(series))}
            />
          </LargeWidget>

          <p>Stacked version with many series:</p>

          <LargeWidget>
            <CategoricalSeriesWidgetVisualization
              plottables={sampleMultiSeriesData.map(
                series => new Bars(series, {stack: 'browsers'})
              )}
            />
          </LargeWidget>
        </Fragment>
      );
    });

    story('Loading Placeholder', () => {
      return (
        <Fragment>
          <p>
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization" /> includes a
            loading placeholder. You can use it via{' '}
            <Storybook.JSXNode name="CategoricalSeriesWidgetVisualization.LoadingPlaceholder" />
          </p>

          <SmallWidget>
            <CategoricalSeriesWidgetVisualization.LoadingPlaceholder />
          </SmallWidget>
        </Fragment>
      );
    });
  }
);

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
