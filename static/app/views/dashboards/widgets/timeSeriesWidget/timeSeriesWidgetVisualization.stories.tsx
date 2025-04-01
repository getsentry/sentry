import {Fragment, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {shiftTabularDataToNow} from 'sentry/utils/tabularData/shiftTabularDataToNow';
import {shiftTimeSeriesToNow} from 'sentry/utils/timeSeries/shiftTimeSeriesToNow';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

import type {LegendSelection, Release, TimeSeries, TimeSeriesMeta} from '../common/types';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleScoreTimeSeries} from './fixtures/sampleScoreTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {spanSamplesWithDurations} from './fixtures/spanSamplesWithDurations';
import {Area} from './plottables/area';
import {Bars} from './plottables/bars';
import {Line} from './plottables/line';
import {Samples} from './plottables/samples';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const sampleDurationTimeSeries2 = {
  ...sampleDurationTimeSeries,
  field: 'p50(span.duration)',
  data: sampleDurationTimeSeries.data.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.3 + 30 * Math.random() : null,
    };
  }),
};

const sampleDurationTimeSeries3 = {
  ...sampleDurationTimeSeries,
  field: 'p75(span.duration)',
  data: sampleDurationTimeSeries.data.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.1 + 30 * Math.random() : null,
    };
  }),
};

export default storyBook('TimeSeriesWidgetVisualization', (story, APIReference) => {
  APIReference(types.TimeSeriesWidgetVisualization);

  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> is a feature-full time series
          chart, designed to plot data returned from <code>/events-stats/</code> endpoints
          in Explore, Dashboards, and other similar UIs.
        </p>
        <p>
          It includes features like:
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
          If you (or someone you know) is plotting Sentry data and the X axis is time, you
          should be using this component! It's highly configurable, and should suit your
          needs. If it doesn't, reach out to the Dashboards team.
        </p>

        <SideBySide>
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
                new Area(sampleDurationTimeSeries2),
              ]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(sampleDurationTimeSeries),
                new Line(sampleDurationTimeSeries2),
              ]}
            />
          </SmallWidget>
        </SideBySide>
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
          <JSXNode name="TimeSeriesWidgetVisualization" /> accepts the{' '}
          <code>plottables</code> prop. Every item in the <code>plottables</code> array
          must be an object of a class that implements the <code>Plottable</code>{' '}
          interface. A few of these objects are already implemented, and ready to use! For
          example <code>Line</code> is a continuous line, suitable for normal line charts.
          You'll probably be using plottables like <code>Line</code>, <code>Area</code>,
          and <code>Bars</code> most of the time. Here's a simple example:
        </p>

        <CodeSnippet language="jsx">
          {`
<TimeSeriesWidgetVisualization
  plottables={[new Line(timeSeries)]}
/>
          `}
        </CodeSnippet>

        <p>
          <code>Line</code>, <code>Area</code>, and <code>Bars</code> accept a{' '}
          <code>TimeSeries</code> object, and a configuration object.{' '}
          <code>TimeSeries</code> is in special format that we're slowly aligning with the
          server responses. For now, you will probably have to transform your data into
          this format. Here's an example of a <code>TimeSeries</code>:
        </p>

        <CodeSnippet language="json">
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
      "timestamp": "2024-10-24T15:00:00-04:00",
    },
    {
      "value": 164.07690380778297,
      "timestamp": "2024-10-24T15:30:00-04:00",
    },
  ]
}
        `}
        </CodeSnippet>

        <p>
          The configuration object depends on the plottable. You will find detailed
          documentation for plottable options below.
        </p>

        <CodeSnippet language="jsx">
          {`
<TimeSeriesWidgetVisualization
  plottables={[
    new Bars(timeSeries, {color: 'red', delay: 60 * 60 * 3, stack: 'all'}),
    new Bars(timeSeries2, {color: 'yellow', delay: 60 * 60 * 3, stack: 'all'})
  ]}
/>
          `}
        </CodeSnippet>
      </Fragment>
    );
  });

  story('Data Types', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> can plot most, but not all data
          types that come back from our time series endpoints. The supported data types
          are:
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
        </p>
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
          <JSXNode name="TimeSeriesWidgetVisualization" /> will automatically set up
          correct Y axes for the plottables. The logic goes like this:
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

        <SideBySide>
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
                new Line(shiftTimeSeriesToNow(sampleThroughputTimeSeries), {delay: 90}),
                new Line(shiftTimeSeriesToNow(sampleDurationTimeSeries), {delay: 90}),
                new Line(shiftTimeSeriesToNow(sampleDurationTimeSeries2), {delay: 90}),
              ]}
            />
          </MediumWidget>
        </SideBySide>

        <p>
          In rare cases, none of the data will have a known type. In these cases we drop
          down to a generic "number" axis. This also accounts for combinations of unknown
          types and the generic "number" type.
        </p>

        <SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line({
                  ...sampleThroughputTimeSeries,
                  field: 'equation|spm() + 1',
                  meta: NULL_META,
                }),
                new Line({
                  ...sampleDurationTimeSeries,
                  field: 'custom_aggregate()',
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
                  field: 'equation|spm() + 1',
                  meta: {
                    type: 'number',
                    unit: null,
                  },
                }),
                new Line({
                  ...sampleDurationTimeSeries,
                  field: 'custom_aggregate()',
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
                  field: 'custom_agg(duration)',
                  meta: {
                    type: 'number',
                    unit: null,
                  },
                }),
                new Line({
                  ...sampleDurationTimeSeries2,
                  field: 'custom_agg2(duration)',
                  meta: {
                    type: 'integer',
                    unit: null,
                  },
                }),
                new Line({
                  ...sampleThroughputTimeSeries,
                  field: 'custom_agg3(duration)',
                  meta: {
                    type: 'duration',
                    unit: DurationUnit.MILLISECOND,
                  },
                }),
              ]}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Unit Alignment', () => {
    const millisecondsSeries = sampleDurationTimeSeries;

    // Create a very similar series, but with a different unit to demonstrate automatic scaling
    const secondsSeries: TimeSeries = {
      field: 'p99(span.self_time)',
      data: sampleDurationTimeSeries.data.map(datum => {
        return {
          ...datum,
          value: datum.value ? (datum.value / 1000) * (1 + Math.random() / 10) : null, // Introduce jitter so the series is visible
        };
      }),
      meta: {
        type: 'duration',
        unit: DurationUnit.SECOND,
      },
    };

    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> can plot multiple time series
          while accounting for their type and units. It adds X axis formatting, Y axis
          formatting, a tooltip with correct units, it will scale units of the same type
          if needed.
        </p>

        <SmallSizingWindow>
          <FillParent>
            <TimeSeriesWidgetVisualization
              plottables={[new Bars(millisecondsSeries), new Line(secondsSeries)]}
            />
          </FillParent>
        </SmallSizingWindow>
      </Fragment>
    );
  });

  story('Samples', () => {
    const [sampleId, setSampleId] = useState<string>();

    const timeSeriesPlottable = useMemo(() => {
      return new Bars(shiftTimeSeriesToNow(sampleDurationTimeSeries), {
        delay: 1800,
      });
    }, []);

    const samplesPlottable = useMemo(() => {
      return new Samples(shiftTabularDataToNow(spanSamplesWithDurations), {
        alias: 'Span Samples',
        attributeName: 'p99(span.duration)',
        baselineValue: 175,
        baselineLabel: 'Average',
        onHighlight: row => {
          setSampleId(row.id);
        },
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

        <p>
          <code>Samples</code> supports the <code>onHighlight</code> configuration option.
          It's a callback, called whenever a sample is highlighted by bringing the X axis
          cursor near its timestamp. e.g., here's the sample ID of the most recent
          highlighted sample: {sampleId}
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

        <SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(sampleDurationTimeSeries, {}),
                new Bars(sampleDurationTimeSeries2, {}),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(sampleDurationTimeSeries, {stack: 'all'}),
                new Bars(sampleDurationTimeSeries2, {stack: 'all'}),
              ]}
            />
          </MediumWidget>
          <SmallWidget />
        </SideBySide>
        <p>
          Since stacking is configured per plottable, you can combine stacked and
          unstacked series. Be wary, this creates really high information density, so
          don't do this on small charts.
        </p>
        <LargeWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Bars(sampleDurationTimeSeries, {stack: 'all'}),
              new Bars(sampleDurationTimeSeries2, {stack: 'all'}),
              new Bars(sampleDurationTimeSeries3),
            ]}
          />
        </LargeWidget>
      </Fragment>
    );
  });

  story('Delay', () => {
    const shiftedSampleDurationTimeSeries = shiftTimeSeriesToNow(
      sampleDurationTimeSeries
    );
    const shiftedSampleDurationTimeSeries2 = shiftTimeSeriesToNow(
      sampleDurationTimeSeries2
    );

    const delay = 60 * 60 * 3;

    return (
      <Fragment>
        <p>
          The <code>delay</code> plottable configuration option indicates that this data
          is live, and the last few buckets might not have complete data. The delay is a
          number in seconds. By default the delay is <code>0</code>.
        </p>

        <SideBySide>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Line(shiftedSampleDurationTimeSeries, {delay}),
                new Line(shiftedSampleDurationTimeSeries2, {delay}),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Area(shiftedSampleDurationTimeSeries, {delay}),
                new Area(shiftedSampleDurationTimeSeries2, {delay}),
              ]}
            />
          </MediumWidget>
          <MediumWidget>
            <TimeSeriesWidgetVisualization
              plottables={[
                new Bars(shiftedSampleDurationTimeSeries, {delay, stack: 'all'}),
                new Bars(shiftedSampleDurationTimeSeries2, {delay, stack: 'all'}),
              ]}
            />
          </MediumWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Color', () => {
    const theme = useTheme();

    const timeSeries: TimeSeries = {
      ...sampleThroughputTimeSeries,
      field: 'error_rate()',
      meta: {
        type: 'rate',
        unit: RateUnit.PER_SECOND,
      },
    };

    return (
      <Fragment>
        <p>
          You can control the color of each plottable by setting the <code>color</code>{' '}
          plotting configuration option to a string that contains a valid hex color code.
        </p>
        <SideBySide>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Line(timeSeries, {color: theme.error})]}
            />
          </SmallWidget>
          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Area(timeSeries, {color: theme.error})]}
            />
          </SmallWidget>

          <SmallWidget>
            <TimeSeriesWidgetVisualization
              plottables={[new Bars(timeSeries, {color: theme.error})]}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Loading Placeholder', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> includes a loading placeholder.
          You can use it via{' '}
          <JSXNode name="TimeSeriesWidgetVisualization.LoadingPlaceholder" />
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
      sampleDurationTimeSeries2,
      start,
      end
    );

    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> supports drag-to-select.
          Dragging the mouse over the visualization area and releasing the cursor will
          update the page URL with the new datetime selection. You can press{' '}
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
      p99: false,
    });

    return (
      <Fragment>
        <p>
          <JSXNode name="TimeSeriesWidgetVisualization" /> supports series legends, and a
          few features on top of them. By default, if only one plottable is provided, the
          legend does not appear. If there are multiple plottables, a legend is shown
          above the charts.
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
          give the legends and tooltips a friendlier name. In this example, verbose names
          like "p99(span.duration)" are truncated, and the p99 series is hidden by
          default.
        </p>

        <code>{JSON.stringify(legendSelection)}</code>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Area(sampleDurationTimeSeries, {alias: 'p50'}),
              new Area(sampleDurationTimeSeries2, {alias: 'p99'}),
            ]}
            legendSelection={legendSelection}
            onLegendSelectionChange={setLegendSelection}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Releases', () => {
    const releases = [
      {
        version: 'ui@0.1.2',
        timestamp: sampleThroughputTimeSeries.data.at(2)?.timestamp,
      },
      {
        version: 'ui@0.1.3',
        timestamp: sampleThroughputTimeSeries.data.at(20)?.timestamp,
      },
    ].filter(hasTimestamp);

    return (
      <Fragment>
        <p>
          Area and line charts support showing release markers via the{' '}
          <code>releases</code> prop. Clicking on a release line will open the release
          details page.
        </p>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Line({
                ...sampleThroughputTimeSeries,
                field: 'error_rate()',
              }),
            ]}
            releases={releases}
          />
        </MediumWidget>
      </Fragment>
    );
  });
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

const SmallSizingWindow = styled(SizingWindow)`
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
    data: timeSeries.data.filter(datum => {
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
  type: null,
  unit: null,
};
