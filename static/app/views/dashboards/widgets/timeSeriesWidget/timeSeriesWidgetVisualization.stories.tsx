import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import {decodeScalar} from 'sentry/utils/queryString';
import {shiftTimeSeriesToNow} from 'sentry/utils/timeSeries/shiftTimeSeriesToNow';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

import type {LegendSelection, Release, TimeSeries} from '../common/types';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {Area} from './plottables/area';
import {Bars} from './plottables/bars';
import {Line} from './plottables/line';
import {TimeSeriesWidgetVisualization} from './timeSeriesWidgetVisualization';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const sampleDurationTimeSeries2 = {
  ...sampleDurationTimeSeries,
  field: 'p50(span.duration)',
  data: sampleDurationTimeSeries.data.map(datum => {
    return {
      ...datum,
      value: datum.value * 0.3 + 30 * Math.random(),
    };
  }),
  meta: {
    fields: {
      'p50(span.duration)': 'duration',
    },
    units: {
      'p50(span.duration)': 'millisecond',
    },
  },
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
            <li>scaling mis-matched units</li>
            <li>displaying incomplete ingestion buckets</li>
            <li>multi-type plotting</li>
            <li>
              support for <code>null</code> values
            </li>
            <li>
              stripping legend names of internal information like <code>equation|</code>{' '}
              prefixes
            </li>
            <li>flexible size</li>
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
                new Line(sampleDurationTimeSeries2),
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
            Bar charts are to your discretion, it's most an aesthetic choice. Generally,
            bars communicate discrete buckets, and lines communicate continuous data. If
            you are plotting something like duration, even if it's broken down by time
            buckets, a line feels right. If you are plotting someting like throughput (a
            naturally bucketed value) and the buckets are big, a bar chart might be better
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

  story('Unit Alignment', () => {
    const millisecondsSeries = sampleDurationTimeSeries;

    // Create a very similar series, but with a different unit to demonstrate automatic scaling
    const secondsSeries = {
      field: 'p99(span.self_time)',
      data: sampleDurationTimeSeries.data.map(datum => {
        return {
          ...datum,
          value: (datum.value / 1000) * (1 + Math.random() / 10), // Introduce jitter so the series is visible
        };
      }),
      meta: {
        fields: {
          'p99(span.self_time)': 'duration',
        },
        units: {
          'p99(span.self_time)': 'second',
        },
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
                new Bars(shiftedSampleDurationTimeSeries, {stack: 'all'}),
                new Bars(shiftedSampleDurationTimeSeries2, {stack: 'all'}),
              ]}
            />
          </MediumWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Color', () => {
    const theme = useTheme();

    const timeSeries = {
      ...sampleThroughputTimeSeries,
      field: 'error_rate()',
      meta: {
        fields: {
          'error_rate()': 'rate',
        },
        units: {
          'error_rate()': '1/second',
        },
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
      'p99(span.duration)': false,
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
          You can also provide aliases for legends to give them a friendlier name. In this
          example, verbose names like "p99(span.duration)" are truncated, and the p99
          series is hidden by default.
        </p>

        <MediumWidget>
          <TimeSeriesWidgetVisualization
            plottables={[
              new Area(sampleDurationTimeSeries, {}),
              new Area(sampleDurationTimeSeries2, {}),
            ]}
            aliases={{
              'p99(span.duration)': 'p99',
              'p50(span.duration)': 'p50',
            }}
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
                meta: {
                  fields: {
                    'error_rate()': 'rate',
                  },
                  units: {
                    'error_rate()': '1/second',
                  },
                },
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
