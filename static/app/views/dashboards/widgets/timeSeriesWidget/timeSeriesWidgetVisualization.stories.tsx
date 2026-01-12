import {Fragment, useEffect, useMemo, useState} from 'react';
import documentation from '!!type-loader!sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import shuffle from 'lodash/shuffle';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/core/button';
import {CodeBlock} from 'sentry/components/core/code';
import {ExternalLink} from 'sentry/components/core/link';
import * as Storybook from 'sentry/stories';
import type {DateString} from 'sentry/types/core';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import type {
  LegendSelection,
  Release,
  TimeSeries,
  TimeSeriesMeta,
} from 'sentry/views/dashboards/widgets/common/types';

import {shiftTabularDataToNow} from './__stories__/shiftTabularDataToNow';
import {shiftTimeSeriesToNow} from './__stories__/shiftTimeSeriesToNow';
import {sampleCrashFreeRateTimeSeries} from './fixtures/sampleCrashFreeRateTimeSeries';
import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleScoreTimeSeries} from './fixtures/sampleScoreTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {spanSamplesWithDurations} from './fixtures/spanSamplesWithDurations';
import {Area} from './plottables/area';
import {Bars} from './plottables/bars';
import {Line} from './plottables/line';
import {Samples} from './plottables/samples';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

const sampleDurationTimeSeriesP50: TimeSeries = {
  ...sampleDurationTimeSeries,
  yAxis: 'p50(span.duration)',
  values: sampleDurationTimeSeries.values.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.3 + 30 * Math.random() : null,
    };
  }),
};

const sampleDurationTimeSeriesP75: TimeSeries = {
  ...sampleDurationTimeSeries,
  yAxis: 'p75(span.duration)',
  values: sampleDurationTimeSeries.values.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.1 + 30 * Math.random() : null,
    };
  }),
};

const shiftedSpanSamples = shiftTabularDataToNow(spanSamplesWithDurations);

const releases = [
  {
    version: 'ui@0.1.2',
    timestamp: new Date(sampleThroughputTimeSeries.values.at(2)!.timestamp).toISOString(),
  },
  {
    version: 'ui@0.1.3',
    timestamp: new Date(
      sampleThroughputTimeSeries.values.at(20)!.timestamp
    ).toISOString(),
  },
].filter(hasTimestamp);

export default Storybook.story('TimeSeriesWidgetVisualization', (story, APIReference) => {
  APIReference(documentation.props?.TimeSeriesWidgetVisualization);

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> is a feature-full
          time series chart, designed to plot data returned from{' '}
          <code>/events-stats/</code> endpoints in Explore, Dashboards, and other similar
          UIs. It includes features like:
        </p>

        <ul>
          <li>automatically scaling mis-matched units</li>
          <li>visually deemphasizing incomplete ingestion buckets</li>
          <li>plotting lines, area, and bars on the same visualization</li>
          <li>
            skipping <code>null</code> values while plotting
          </li>
          <li>
            stripping legend names of internal information like <code>equation|</code>{' '}
            prefixes
          </li>
          <li>automatically stretching to fit the parent</li>
          <li>intelligently formatting the axes</li>
          <li>and more!</li>
        </ul>

        <p>
          If you (or someone you know) is plotting Sentry data and the X axis is time, you
          should be using this component! It's highly configurable, and should suit your
          needs. If it doesn't, reach out to the Dashboards team.
        </p>

        <Storybook.SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(sampleThroughputTimeSeries),
                new Bars(sampleDurationTimeSeries),
              ]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Area(sampleDurationTimeSeries),
                new Area(sampleDurationTimeSeriesP50),
              ]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(sampleDurationTimeSeries),
                new Line(sampleDurationTimeSeriesP50),
              ]}
            />
          </SmallWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Choosing The Plot Type', () => {
    return (
      <Fragment>
        <p>
          Here are a few guidelines on how to choose the right visualization for your
          data:
        </p>
        <ul>
          <li>
            Only use area charts if you want to plot multiple series <i>and</i> those
            series represent components of a total. For example, area charts are a good
            choice to show time spent, broken down by span operation. They are not a good
            choice for plotting a single duration time series. Area charts should be
            stacked!
          </li>
          <li>
            Bar charts are to your discretion. Generally, bars communicate discrete
            buckets, and lines communicate continuous data. If you are plotting something
            like duration, even if it's broken down by time buckets, a line feels right.
            If you are plotting someting like throughput (a naturally bucketed value) and
            the buckets are big, a bar chart might be better. Generally, bar charts should
            be bucketed by a pretty long interval, at least a day. Otherwise, there are
            too many bars, they end up too skinny, and they're hard to understand and
            interact with.
          </li>
          <li>Use line charts when in doubt! They are almost always the right choice</li>
        </ul>
      </Fragment>
    );
  });

  story('Plotting and Plottables', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> accepts the{' '}
          <code>plottables</code> prop. Every item in the <code>plottables</code> array
          must be an object of a class that implements the <code>Plottable</code>{' '}
          interface. A few of these objects are already implemented, and ready to use! For
          example <code>Line</code> is a continuous line, suitable for normal line charts.
          You'll probably be using plottables like <code>Line</code>, <code>Area</code>,
          and <code>Bars</code> most of the time. Here's a simple example:
        </p>

        <CodeBlock language="jsx">
          {`
<TimeSeriesWidgetVisualization
  plottables={[new Line(timeSeries)]}
/>
          `}
        </CodeBlock>

        <p>
          <code>Line</code>, <code>Area</code>, and <code>Bars</code> accept a{' '}
          <code>TimeSeries</code> object, and a configuration object.{' '}
          <code>TimeSeries</code> is in special format that we're slowly aligning with the
          server responses. For now, you will probably have to transform your data into
          this format. Here's an example of a <code>TimeSeries</code>:
        </p>

        <CodeBlock language="json">
          {`
{
  "field": "p99(span.duration)",
  "meta": {
    "fields": {
      "p99(span.duration)": "duration",
    },
    "units": {
      "p99(span.duration)": "millisecond",
    },
  },
  "data": [
    {
      "value": 163.26759544018776,
      "timestamp": 1729798200000,
    },
    {
      "value": 164.07690380778297,
      "timestamp": 1729800000000,
    },
  ]
}
        `}
        </CodeBlock>

        <p>
          The configuration object depends on the plottable. You will find detailed
          documentation for plottable options below.
        </p>

        <CodeBlock language="jsx">
          {`
<TimeSeriesWidgetVisualization
  plottables={[
    new Bars(timeSeries, {color: 'red', stack: 'all'}),
    new Bars(timeSeries2, {color: 'yellow', stack: 'all'})
  ]}
/>
          `}
        </CodeBlock>
      </Fragment>
    );
  });

  story('Data Types', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> can plot most, but
          not all data types that come back from our time series endpoints. The supported
          data types are:
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
          <li>
            <code>score</code>
          </li>
        </ul>

        <p>
          Each of those types has specific behavior in its axes range, axis value
          formatting, tooltip formatting, unit scaling, and so on. For example, the{' '}
          <code>score</code> type always uses the 0-100 Y axis range.
        </p>
        <MediumWidget>
          <TimeSeriesWidgetVisualization plottables={[new Area(sampleScoreTimeSeries)]} />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Y Axes', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> will automatically
          set up correct Y axes for the plottables. The logic goes like this:
        </p>
        <ul>
          <li>
            look through all the plottables in order, and determine which types they have
          </li>
          <li>
            place a left-side Y axis, using the most common data type among the plottables
          </li>
          <li>
            if there are two total data types, place a second Y axis on the right side
          </li>
          <li>
            if there are more than 2 total data types, set the second Y axis to "number"
          </li>
        </ul>

        <p>
          The charts below should have one throughput axis, and one duration axis. In both
          cases, the duration should be on the left.
        </p>

        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(sampleDurationTimeSeries),
                new Line(sampleThroughputTimeSeries),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(shiftTimeSeriesToNow(sampleThroughputTimeSeries), {}),
                new Line(shiftTimeSeriesToNow(sampleDurationTimeSeries), {}),
                new Line(shiftTimeSeriesToNow(sampleDurationTimeSeriesP50), {}),
              ]}
            />
          </MediumWidget>
        </Storybook.SideBySide>

        <p>
          In rare cases, none of the data will have a known type. In these cases we drop
          down to a generic "number" axis. This also accounts for combinations of unknown
          types and the generic "number" type.
        </p>

        <Storybook.SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleThroughputTimeSeries,
                  yAxis: 'equation|spm() + 1',
                  meta: NULL_META,
                }),
                new Line({
                  ...sampleDurationTimeSeries,
                  yAxis: 'custom_aggregate()',
                  meta: NULL_META,
                }),
              ]}
            />
          </SmallWidget>

          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleThroughputTimeSeries,
                  yAxis: 'equation|spm() + 1',
                  meta: {
                    ...sampleThroughputTimeSeries.meta,
                    valueType: 'number',
                    valueUnit: null,
                  },
                }),
                new Line({
                  ...sampleDurationTimeSeries,
                  yAxis: 'custom_aggregate()',
                  meta: NULL_META,
                }),
              ]}
            />
          </SmallWidget>

          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleDurationTimeSeries,
                  yAxis: 'custom_agg(duration)',
                  meta: {
                    ...sampleThroughputTimeSeries.meta,
                    valueType: 'number',
                    valueUnit: null,
                  },
                }),
                new Line({
                  ...sampleDurationTimeSeriesP50,
                  yAxis: 'custom_agg2(duration)',
                  meta: {
                    ...sampleThroughputTimeSeries.meta,
                    valueType: 'integer',
                    valueUnit: null,
                  },
                }),
                new Line({
                  ...sampleThroughputTimeSeries,
                  yAxis: 'custom_agg3(duration)',
                  meta: {
                    ...sampleThroughputTimeSeries.meta,
                    valueType: 'duration',
                    valueUnit: DurationUnit.MILLISECOND,
                  },
                }),
              ]}
            />
          </SmallWidget>
        </Storybook.SideBySide>

        <p>
          A common issue with Y axes is data ranges. Some time series, like crash rates
          tend to hover very close to 100%. In these cases, starting the Y axis at 0 can
          make it difficult to see the actual values. You can set the{' '}
          <code>axisRange</code> prop to <code>"dataMin"</code> to start the Y axis at the
          minimum value of the data.
        </p>

        <p>
          In the charts below you can see an example. The left chart is not very useful,
          because it looks like a flat line at 100%. The chart in the middle shows the
          actual data much clearer, and a dip is visible.
        </p>

        <Storybook.SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Line(sampleCrashFreeRateTimeSeries)]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Line(sampleCrashFreeRateTimeSeries)]}
              axisRange="dataMin"
            />
          </SmallWidget>
        </Storybook.SideBySide>

        <p>A few notes of caution:</p>
        <ol>
          <li>
            This only works well for line series. If you try this with area or bar
            plottables you will have a bad time because the chart will look weird and make
            no sense
          </li>
          <li>
            If your data range is very narrow (e.g., &lt;0.00001) you will have a bad time
            because the Y axis labels will become very long to accommodate the high
            precision
          </li>
          <li>
            Some customers find floating Y axis minimum disorienting. When they change the
            date range or environment, the floating Y axis minimum makes it harder to
            compare the data visually
          </li>
        </ol>
      </Fragment>
    );
  });

  story('X Axis', () => {
    return (
      <Fragment>
        <p>
          In a <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />, the X axis is
          by definition always time. The ticks and labels are automatically determined
          based on the domain of the data set. You can, however, use the{' '}
          <code>showXAxis</code> prop to hide the X axis in contexts where it would be too
          busy or distracting. This might be the case in small sidebar charts, for
          example. Setting the <code>showXAxis</code> prop to <code>"never"</code> will
          hide the X axis.
        </p>

        <SmallWidget>
          <TimeSeriesWidgetVisualization
            plottables={[new Line(sampleDurationTimeSeries)]}
            showXAxis="never"
          />
        </SmallWidget>
      </Fragment>
    );
  });

  story('Unit Alignment', () => {
    const millisecondsSeries = sampleDurationTimeSeries;

    // Create a very similar series, but with a different unit to demonstrate automatic scaling
    const secondsSeries: TimeSeries = {
      yAxis: 'p99(span.self_time)',
      values: sampleDurationTimeSeries.values.map(datum => {
        return {
          ...datum,
          value: datum.value ? (datum.value / 1000) * (1 + Math.random() / 10) : null, // Introduce jitter so the series is visible
        };
      }),
      meta: {
        ...sampleThroughputTimeSeries.meta,
        valueType: 'duration',
        valueUnit: DurationUnit.SECOND,
      },
    };

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> can plot multiple
          time series while accounting for their type and units. It adds X axis
          formatting, Y axis formatting, a tooltip with correct units, it will scale units
          of the same type if needed.
        </p>

        <SmallStorybookSizingWindow>
          <FillParent>
            <TimeSeriesWidgetVisualization
              plottables={[new Bars(millisecondsSeries), new Line(secondsSeries)]}
            />
          </FillParent>
        </SmallStorybookSizingWindow>
      </Fragment>
    );
  });

  story('Samples', () => {
    const timeSeriesPlottable = useMemo(() => {
      return new Bars(shiftTimeSeriesToNow(sampleDurationTimeSeries), {});
    }, []);

    const samplesPlottable = useMemo(() => {
      return new Samples(shiftedSpanSamples, {
        alias: 'Span Samples',
        attributeName: 'p99(span.duration)',
        baselineValue: 175,
        baselineLabel: 'Average',
      });
    }, []);

    return (
      <Fragment>
        <p>
          <code>Samples</code> plots discontinuous points. It's useful for placing markers
          for individual events on top of a continuous aggregate series. In the example
          below, we plot a set of span duration samples on top of an aggregate series of
          the 99th percentile of those durations. Samples that are faster than a baseline
          are green, samples that are slower are red.
        </p>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            plottables={[timeSeriesPlottable, samplesPlottable]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Stacking', () => {
    return (
      <Fragment>
        <p>
          Plottables are <i>unstacked</i> by default. To turn on stacking, use the{' '}
          <code>stack</code> plottable configuration option. Note that only{' '}
          <code>Bars</code> supports this! <code>Area</code> plottables are always
          stacked. <code>Line</code> plottables are never stacked.
        </p>

        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(sampleDurationTimeSeries, {}),
                new Bars(sampleDurationTimeSeriesP50, {}),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(sampleDurationTimeSeries, {stack: 'all'}),
                new Bars(sampleDurationTimeSeriesP50, {stack: 'all'}),
              ]}
            />
          </MediumWidget>
          <SmallWidget />
        </Storybook.SideBySide>
        <p>
          Since stacking is configured per plottable, you can combine stacked and
          unstacked series. Be wary, this creates really high information density, so
          don't do this on small charts.
        </p>
        <LargeWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Bars(sampleDurationTimeSeries, {stack: 'all'}),
              new Bars(sampleDurationTimeSeriesP50, {stack: 'all'}),
              new Bars(sampleDurationTimeSeriesP75),
            ]}
          />
        </LargeWidget>
      </Fragment>
    );
  });

  story('Incomplete Data', () => {
    const createIncompleteTimeSeriesClone = function (
      timeSeries: TimeSeries
    ): TimeSeries {
      return {
        ...timeSeries,
        values: timeSeries.values.map((value, index) => {
          if (index < 5 || index > 50 || (index > 20 && index < 25)) {
            return {...value, incomplete: true};
          }
          return value;
        }),
      };
    };

    const incompleteDurationTimeSeries = createIncompleteTimeSeriesClone(
      sampleDurationTimeSeries
    );
    const incompleteDurationP50TimeSeries = createIncompleteTimeSeriesClone(
      sampleDurationTimeSeriesP50
    );

    return (
      <Fragment>
        <p>
          You can mark data as incomplete by setting the <code>incomplete</code> property
          to <code>true</code> for the data points in the <code>TimeSeries</code> that are
          not complete. An incomplete data point might be caused by an ingestion delay, a
          filter that's misaligned with the bucket edges, or any other number of reasons.
        </p>

        <p>
          The sample data series in these stories have several incomplete data points, and
          you can see them visualized as dotted lines and pale areas. The examples below
          show this in more detail.
        </p>

        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(incompleteDurationTimeSeries),
                new Line(incompleteDurationP50TimeSeries),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Area(incompleteDurationTimeSeries),
                new Area(incompleteDurationP50TimeSeries),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(incompleteDurationTimeSeries, {
                  stack: 'all',
                }),
                new Bars(incompleteDurationP50TimeSeries, {
                  stack: 'all',
                }),
              ]}
            />
          </MediumWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Click Events', () => {
    const [sampleId, setSampleId] = useState<string>();

    const samplesPlottable = useMemo(() => {
      return new Samples(shiftedSpanSamples, {
        alias: 'Span Samples',
        attributeName: 'p99(span.duration)',
        baselineValue: 175,
        baselineLabel: 'Average',
        onClick: row => {
          setSampleId(row.id);
        },
      });
    }, []);

    return (
      <Fragment>
        <p>
          You can respond to chart click events by passing the <code>onClick</code>{' '}
          configuration option, if it's supported by the relevant plottable. Right now,
          only the <code>Samples</code> plottable supports this configuration option.
        </p>

        <MediumWidget>
          <TimeSeriesWidgetVisualization plottables={[samplesPlottable]} />

          <p>Clicked sample ID: {sampleId}</p>
        </MediumWidget>
      </Fragment>
    );
  });

  story('Highlighting', () => {
    const [legendSelection, setLegendSelection] = useState<LegendSelection>({});
    const [sampleId, setSampleId] = useState<string | null>(null);

    const aggregatePlottable = new Line(
      shiftTimeSeriesToNow(sampleDurationTimeSeries),
      {}
    );

    const samplesPlottable = useMemo(() => {
      return new Samples(shiftedSpanSamples, {
        alias: 'Span Samples',
        attributeName: 'p99(span.duration)',
        baselineValue: 175,
        baselineLabel: 'Average',
        onHighlight: row => {
          setSampleId(row.id);
        },
        onDownplay: () => {
          setSampleId(null);
        },
      });
    }, []);

    // Synchronize the highlighted sample ID state with ECharts
    useEffect(() => {
      const sample = shiftedSpanSamples.data.find(datum => datum.id === sampleId)!;

      // Highlight the new selected sample
      if (sample) {
        samplesPlottable.highlight(sample);
      }

      return () => {
        // Downplay the previous selected sample
        if (sample) {
          samplesPlottable.downplay(sample);
        }
      };
    }, [sampleId, samplesPlottable]);

    return (
      <Fragment>
        <p>
          You can control the highlighting of data points on your charts in two ways. The
          first way is to pass the <code>onHighlight</code> configuration option to your
          plottable. All plottables support this configuration option. It's a callback,
          called whenever a data point is highlighted by bringing the X axis cursor near
          its timestamp. There is also a corresponding <code>onDownplay</code> option. The
          second way is to manually cause highlighting on your plottables by calling the{' '}
          <code>highlight</code> method of the plottable instance. Note: only{' '}
          <code>Samples</code> supports this right now.
        </p>

        <p>
          e.g., the <code>Samples</code> plottable in the chart below has both a callback,
          and manual highlighting. The callback reports the ID of the currently
          highlighted sample. The "Highlight Random Sample" button manually highlights a
          random sample in the plottable.
        </p>

        <Button
          size="sm"
          onClick={() => {
            const sample = shuffle(shiftedSpanSamples.data).find(
              shuffledSample => shuffledSample.id !== sampleId
            ) as {
              id: string;
              timestamp: string;
            };

            setSampleId(sample.id);
          }}
        >
          Highlight Random Sample
        </Button>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            legendSelection={legendSelection}
            onLegendSelectionChange={setLegendSelection}
            plottables={[aggregatePlottable, samplesPlottable]}
          />

          <p>Highlighted sample ID: {sampleId}</p>
        </MediumWidget>
      </Fragment>
    );
  });

  story('Color', () => {
    const theme = useTheme();

    const timeSeries: TimeSeries = {
      ...sampleThroughputTimeSeries,
      yAxis: 'error_rate()',
      meta: {
        ...sampleThroughputTimeSeries.meta,
        valueType: 'rate',
        valueUnit: RateUnit.PER_SECOND,
      },
    };

    return (
      <Fragment>
        <p>
          You can control the color of each plottable by setting the <code>color</code>{' '}
          plotting configuration option to a string that contains a valid hex color code.
        </p>
        <Storybook.SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Line(timeSeries, {color: theme.tokens.content.danger})]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Area(timeSeries, {color: theme.tokens.content.danger})]}
            />
          </SmallWidget>

          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Bars(timeSeries, {color: theme.tokens.content.danger})]}
            />
          </SmallWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Loading Placeholder', () => {
    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> includes a loading
          placeholder. You can use it via{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization.LoadingPlaceholder" />
        </p>

        <SmallWidget>
          <TimeSeriesWidgetVisualization.LoadingPlaceholder />
        </SmallWidget>
      </Fragment>
    );
  });

  story('Drag to Select', () => {
    const {start, end} = useLocationQuery({
      fields: {
        start: decodeScalar,
        end: decodeScalar,
      },
    });

    const durationTimeSeries1 = toTimeSeriesSelection(
      sampleDurationTimeSeries,
      start,
      end
    );

    const durationTimeSeries2 = toTimeSeriesSelection(
      sampleDurationTimeSeriesP50,
      start,
      end
    );

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> supports
          drag-to-select. Dragging the mouse over the visualization area and releasing the
          cursor will update the page URL with the new datetime selection. You can press{' '}
          <code>escape</code> during selection to cancel selection. Give it a try!
        </p>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Line(durationTimeSeries1, {}),
              new Line(durationTimeSeries2, {}),
            ]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Legends', () => {
    const [legendSelection, setLegendSelection] = useState<LegendSelection>({
      'p99(span.duration)': false,
    });

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> supports series
          legends, and a few features on top of them. By default, if only one plottable is
          provided, the legend does not appear. If there are multiple plottables, a legend
          is shown above the charts.
        </p>
        <p>
          You can control legend selection with the <code>legendSelection</code> prop. By
          default, all plottables are shown. If any plottable is set to <code>false</code>{' '}
          (keyed by <code>timeSeries.field</code>) it will be hidden. The companion{' '}
          <code>onLegendSelectionChange</code> prop is a callback, it will tell you when
          the user changes the legend selection by clicking on legend labels.
        </p>
        <p>
          You can also provide aliases for plottables like <code>Line</code> This will
          give the legends and tooltips a friendlier name. In the first example, verbose
          names like "p99(span.duration)" are truncated, and the p99 series is hidden by
          default. The legend will always include an entry for every plottable, even if
          some plottables have the same alias, as you can see in the second example.
        </p>
        <p>
          By default, <Storybook.JSXNode name="TimeSeriesWidgetVisualization" /> creates
          legend labels using all information from the <code>TimeSeries</code> object,
          including the <code>yAxis</code> and the <code>groupBy</code>. In the first two
          examples, the label uses the <code>yAxis</code> property. In the third example,
          each <code>TimeSeries</code> has a <code>groupBy</code> property, so the{' '}
          <code>yAxis</code> property is not shown in the label. The best way to override
          this is by using the <code>alias</code> of a plottable.
        </p>

        <code>{JSON.stringify(legendSelection)}</code>

        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Area(sampleDurationTimeSeries, {alias: 'p99'}),
                new Area(sampleDurationTimeSeriesP50, {alias: 'p50'}),
              ]}
              legendSelection={legendSelection}
              onLegendSelectionChange={setLegendSelection}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Area(sampleDurationTimeSeries, {alias: 'Duration'}),
                new Area(sampleDurationTimeSeriesP50, {alias: 'Duration'}),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleDurationTimeSeries,
                  yAxis: 'span.duration()',
                  groupBy: [
                    {
                      key: 'release',
                      value: 'proj@v0.6.2',
                    },
                    {
                      key: 'env',
                      value: 'production',
                    },
                  ],
                }),
                new Line({
                  ...sampleDurationTimeSeriesP50,
                  yAxis: 'span.duration()',
                  groupBy: [
                    {
                      key: 'release',
                      value: 'proj@v0.6.1',
                    },
                    {
                      key: 'env',
                      value: 'production',
                    },
                  ],
                }),
              ]}
            />
          </MediumWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Releases', () => {
    return (
      <Fragment>
        <p>
          Area and line charts support showing release markers via the{' '}
          <code>releases</code> prop with two different visualizations specified by the
          <code>showReleaseAs</code> prop: <code>"line"</code> and <code>"bubble"</code>.
        </p>

        <p>
          Clicking on a release bubble will open the releases flyout. Releases lines
          should be reserved for inside the flyout when there are an appropriate number of
          releases to display. Clicking on a release line should open the release details
          inside of the flyout.
        </p>

        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleThroughputTimeSeries,
                  yAxis: 'error_rate()',
                }),
              ]}
              releases={releases}
            />
          </MediumWidget>

          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleThroughputTimeSeries,
                  yAxis: 'error_rate()',
                }),
              ]}
              showReleaseAs="bubble"
              releases={releases}
            />
          </MediumWidget>
        </Storybook.SideBySide>
        <Storybook.SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(sampleThroughputTimeSeries),
                new Line(sampleDurationTimeSeries),
                new Line(sampleDurationTimeSeriesP50),
              ]}
              releases={releases}
              showReleaseAs="bubble"
            />
          </MediumWidget>
        </Storybook.SideBySide>
      </Fragment>
    );
  });
  story('Deep-Linking', () => (
    <div>
      <p>
        Deep-linking to a chart works by mapping a unique ID to a self-contained component
        that renders a chart and handles all the data-fetching required to do so. The{' '}
        <ExternalLink href="https://github.com/getsentry/sentry/blob/master/static/app/components/charts/chartWidgetLoader.tsx">
          <Storybook.JSXNode name="ChartWidgetLoader" />
        </ExternalLink>{' '}
        component is where this mapping occurs and handles loading the module and
        rendering the component.
      </p>

      <p>The following are the required steps in order to deep-link to a chart:</p>

      <ul>
        <li>
          Create a new component in{' '}
          <ExternalLink href="https://github.com/getsentry/sentry/tree/master/static/app/views/insights/common/components/widgets">
            <code>static/app/views/insights/common/components/widgets</code>
          </ExternalLink>
          . These currently are only used in Insights, but we can move them to a more
          common location if they are useful elsewhere. We want a specific location so
          that we can enforce lint rules.
        </li>
        <li>
          Components need to be self-contained: they should not accept any additional
          props beyond <code>LoadableChartWidgetProps</code> and should manage their own
          data-fetching
        </li>
        <li>
          Components need to pass a unique <code>id</code> prop to{' '}
          <Storybook.JSXNode name="TimeSeriesWidgetVisualization" />. This <code>id</code>{' '}
          should also match the filename.
        </li>
        <li>
          Components need to be a <code>default</code> export
        </li>
        <li>
          Component must be manually mapped in{' '}
          <ExternalLink href="https://github.com/getsentry/sentry/blob/master/static/app/components/charts/chartWidgetLoader.tsx">
            <Storybook.JSXNode name="ChartWidgetLoader" />
          </ExternalLink>{' '}
          so that these paths are statically analyzable
        </li>
      </ul>

      <p>
        Here's an example component, it would be in a file named{' '}
        <code>databaseLandingDurationChartWidget.tsx</code>. Also, in{' '}
        <ExternalLink href="https://github.com/getsentry/sentry/blob/master/static/app/components/charts/chartWidgetLoader.tsx">
          <Storybook.JSXNode name="ChartWidgetLoader" />
        </ExternalLink>
        , be sure to also map its id to a a function that dynamically imports the
        component.
      </p>

      <CodeBlock language="tsx">
        {`
// In the file static/app/views/insights/common/components/widgets/databaseLandingDurationChartWidget.tsx
export default function DatabaseLandingDurationChartWidget(
  props: LoadableChartWidgetProps
) {
  const {isPending, data, error} = useDatabaseLandingDurationQuery();


  // Note that id matches the filename
  // it also needs to spread props to the underlying component
  return (
    <InsightsLineChartWidget
      {...props}
      id="databaseLandingDurationChartWidget"
      title={getDurationChartTitle('db')}
      series={[data[\`\${DEFAULT_DURATION_AGGREGATE}(span.self_time)\`]]}
      isLoading={isPending}
      error={error}
    />
  );
}


// In static/app/components/charts/chartWidgetLoader.tsx, add this to the CHART_MAP table
{
  "databaseLandingDurationChartWidget": () => import('sentry/views/insights/common/components/widgets/databaseLandingDurationChartWidget')
}
`}
      </CodeBlock>

      <p>
        Please take a look at{' '}
        <ExternalLink href="https://github.com/getsentry/sentry/tree/master/static/app/views/insights/common/components/widgets">
          <code>static/app/views/insights/common/components/widgets</code>
        </ExternalLink>{' '}
        for more examples.
      </p>

      <p>
        Note that there are lint rules to disallow importing of insights chart widget
        comopnents, as well as automated testing on all components in the root of the{' '}
        <ExternalLink href="https://github.com/getsentry/sentry/tree/master/static/app/views/insights/common/components/widgets">
          <code>widgets/</code>
        </ExternalLink>{' '}
        directory to ensure that{' '}
        <ExternalLink href="https://github.com/getsentry/sentry/blob/master/static/app/components/charts/chartWidgetLoader.tsx">
          <Storybook.JSXNode name="ChartWidgetLoader" />
        </ExternalLink>{' '}
        is able to load them all.
      </p>
    </div>
  ));
});

const FillParent = styled('div')`
  width: 100%;
  height: 100%;
`;

const LargeWidget = styled('div')`
  position: relative;
  width: 600px;
  height: 300px;
`;

const MediumWidget = styled('div')`
  position: relative;
  width: 420px;
  height: 250px;
`;

const SmallWidget = styled('div')`
  position: relative;
  width: 360px;
  height: 160px;
`;

const SmallStorybookSizingWindow = styled(Storybook.SizingWindow)`
  width: 50%;
  height: 300px;
`;

function toTimeSeriesSelection(
  timeSeries: TimeSeries,
  start: DateString | null,
  end: DateString | null
): TimeSeries {
  return {
    ...timeSeries,
    values: timeSeries.values.filter(datum => {
      if (start && moment(datum.timestamp).isBefore(moment.utc(start))) {
        return false;
      }

      if (end && moment(datum.timestamp).isAfter(moment.utc(end))) {
        return false;
      }

      return true;
    }),
  };
}

function hasTimestamp(release: Partial<Release>): release is Release {
  return Boolean(release?.timestamp);
}

const NULL_META: TimeSeriesMeta = {
  valueType: 'number',
  valueUnit: null,
  interval: 0,
};
