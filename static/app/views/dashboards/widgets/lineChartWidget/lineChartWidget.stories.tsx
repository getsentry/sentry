import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {Release, TimeseriesData} from '../common/types';

import {LineChartWidget} from './lineChartWidget';
import sampleDurationTimeSeries from './sampleDurationTimeSeries.json';
import sampleThroughputTimeSeries from './sampleThroughputTimeSeries.json';
import {shiftTimeserieToNow} from './shiftTimeserieToNow';

const sampleDurationTimeSeries2 = {
  ...sampleDurationTimeSeries,
  field: 'p50(span.duration)',
  data: sampleDurationTimeSeries.data.map(datum => {
    return {
      ...datum,
      value: datum.value * 0.3 + 30 * Math.random(),
    };
  }),
};

export default storyBook(LineChartWidget, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="LineChartWidget" /> is a Dashboard Widget Component. It displays
          a timeseries chart with one or more timeseries. Used to visualize data that
          changes over time in Project Details, Dashboards, Performance, and other UIs.
        </p>
      </Fragment>
    );
  });

  story('Visualization', () => {
    const {selection} = usePageFilters();
    const {datetime} = selection;
    const {start, end} = datetime;

    const throughputTimeSeries = toTimeSeriesSelection(
      sampleThroughputTimeSeries as unknown as TimeseriesData,
      start,
      end
    );

    const durationTimeSeries1 = toTimeSeriesSelection(
      sampleDurationTimeSeries as unknown as TimeseriesData,
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
          The visualization of <JSXNode name="LineChartWidget" /> a line chart. It has
          some bells and whistles including automatic axes labels, and a hover tooltip.
          Like other widgets, it automatically fills the parent element. The{' '}
          <code>utc</code> prop controls whether the X Axis timestamps are shown in UTC or
          not.
        </p>
        <SmallSizingWindow>
          <LineChartWidget
            title="eps()"
            description="Number of events per second"
            timeseries={[throughputTimeSeries]}
            meta={{
              fields: {
                'eps()': 'rate',
              },
              units: {
                'eps()': '1/second',
              },
            }}
          />
        </SmallSizingWindow>

        <p>
          The <code>dataCompletenessDelay</code> prop indicates that this data is live,
          and the last few buckets might not have complete data. The delay is a number in
          seconds. Any data bucket that happens in that delay window will be plotted with
          a dotted line. By default the delay is <code>0</code>.
        </p>

        <SideBySide>
          <MediumWidget>
            <LineChartWidget
              title="span.duration"
              dataCompletenessDelay={60 * 60 * 3}
              timeseries={[
                shiftTimeserieToNow(durationTimeSeries1),
                shiftTimeserieToNow(durationTimeSeries2),
              ]}
              utc
              meta={{
                fields: {
                  'p99(span.duration)': 'duration',
                  'p50(span.duration)': 'duration',
                },
                units: {
                  'p99(span.duration)': 'millisecond',
                  'p50(span.duration)': 'millisecond',
                },
              }}
            />
          </MediumWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('State', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="LineChartWidget" /> supports the usual loading and error states.
          The loading state shows a spinner. The error state shows a message, and an
          optional "Retry" button.
        </p>

        <SideBySide>
          <SmallWidget>
            <LineChartWidget title="Loading Count" isLoading />
          </SmallWidget>
          <SmallWidget>
            <LineChartWidget title="Missing Count" />
          </SmallWidget>
          <SmallWidget>
            <LineChartWidget
              title="Count Error"
              error={new Error('Something went wrong!')}
            />
          </SmallWidget>
          <SmallWidget>
            <LineChartWidget
              title="Data Error"
              error={new Error('Something went wrong!')}
              onRetry={() => {}}
            />
          </SmallWidget>
        </SideBySide>
      </Fragment>
    );
  });

  story('Colors', () => {
    const theme = useTheme();

    return (
      <Fragment>
        <p>
          You can control the color of each timeseries by setting the <code>color</code>{' '}
          attribute to a string that contains a valid hex color code.
        </p>

        <MediumWidget>
          <LineChartWidget
            title="error_rate()"
            description="Rate of Errors"
            timeseries={[
              {
                ...sampleThroughputTimeSeries,
                field: 'error_rate()',
                color: theme.error,
              } as unknown as TimeseriesData,
            ]}
            meta={{
              fields: {
                'error_rate()': 'rate',
              },
              units: {
                'error_rate()': '1/second',
              },
            }}
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
          <JSXNode name="LineChartWidget" /> supports the <code>releases</code> prop. If
          passed in, the widget will plot every release as a vertical line that overlays
          the chart data. Clicking on a release line will open the release details page.
        </p>

        <MediumWidget>
          <LineChartWidget
            title="error_rate()"
            timeseries={[
              {
                ...sampleThroughputTimeSeries,
                field: 'error_rate()',
              } as unknown as TimeseriesData,
            ]}
            releases={releases}
            meta={{
              fields: {
                'error_rate()': 'rate',
              },
              units: {
                'error_rate()': '1/second',
              },
            }}
          />
        </MediumWidget>
      </Fragment>
    );
  });
});

const MediumWidget = styled('div')`
  width: 420px;
  height: 250px;
`;

const SmallWidget = styled('div')`
  width: 360px;
  height: 160px;
`;

const SmallSizingWindow = styled(SizingWindow)`
  width: 50%;
  height: 300px;
`;

function toTimeSeriesSelection(
  timeSeries: TimeseriesData,
  start: DateString | null,
  end: DateString | null
): TimeseriesData {
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
