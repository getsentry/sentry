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

import type {Release, TimeSeries} from '../common/types';
import {shiftTimeserieToNow} from '../timeSeriesWidget/shiftTimeserieToNow';

import {sampleLatencyTimeSeries} from './fixtures/sampleLatencyTimeSeries';
import {sampleSpanDurationTimeSeries} from './fixtures/sampleSpanDurationTimeSeries';
import {AreaChartWidget} from './areaChartWidget';

export default storyBook('AreaChartWidget', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="AreaChartWidget" /> is a Dashboard Widget Component. It displays
          a timeseries chart with multiple timeseries, and the timeseries are stacked.
          Each timeseries is shown using a solid block of color. This chart is used to
          visualize multiple timeseries that represent parts of something. For example, a
          chart that shows time spent in the app broken down by component. In all other
          ways, it behaves like <JSXNode name="LineChartWidget" />, though it doesn't
          support features like "Previous Period Data".
        </p>
        <p>
          <em>NOTE:</em> This chart is not appropriate for showing a single timeseries!
          You should use <JSXNode name="LineChartWidget" /> instead.
        </p>
      </Fragment>
    );
  });

  story('Visualization', () => {
    const {selection} = usePageFilters();
    const {datetime} = selection;
    const {start, end} = datetime;

    const latencyTimeSeries = toTimeSeriesSelection(sampleLatencyTimeSeries, start, end);

    const spanDurationTimeSeries = toTimeSeriesSelection(
      sampleSpanDurationTimeSeries,
      start,
      end
    );

    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="AreaChartWidget" /> a stacked area chart. It
          has some bells and whistles including automatic axes labels, and a hover
          tooltip. Like other widgets, it automatically fills the parent element.
        </p>
        <SmallSizingWindow>
          <AreaChartWidget
            title="Duration Breakdown"
            description="Explains what proportion of total duration is taken up by latency vs. span duration"
            timeSeries={[latencyTimeSeries, spanDurationTimeSeries]}
          />
        </SmallSizingWindow>

        <p>
          The <code>dataCompletenessDelay</code> prop indicates that this data is live,
          and the last few buckets might not have complete data. The delay is a number in
          seconds. Any data bucket that happens in that delay window will be plotted with
          a fainter fill. By default the delay is <code>0</code>.
        </p>

        <SideBySide>
          <MediumWidget>
            <AreaChartWidget
              title="span.duration"
              dataCompletenessDelay={60 * 60 * 3}
              timeSeries={[
                shiftTimeserieToNow(latencyTimeSeries),
                shiftTimeserieToNow(spanDurationTimeSeries),
              ]}
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
          <JSXNode name="AreaChartWidget" /> supports the usual loading and error states.
          The loading state shows a spinner. The error state shows a message, and an
          optional "Retry" button.
        </p>

        <SideBySide>
          <SmallWidget>
            <AreaChartWidget title="Loading Count" isLoading />
          </SmallWidget>
          <SmallWidget>
            <AreaChartWidget title="Missing Count" />
          </SmallWidget>
          <SmallWidget>
            <AreaChartWidget
              title="Count Error"
              error={new Error('Something went wrong!')}
            />
          </SmallWidget>
          <SmallWidget>
            <AreaChartWidget
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
          <AreaChartWidget
            title="error_rate()"
            description="Rate of Errors"
            timeSeries={[
              {...sampleLatencyTimeSeries, color: theme.error},

              {...sampleSpanDurationTimeSeries, color: theme.warning},
            ]}
          />
        </MediumWidget>
      </Fragment>
    );
  });

  story('Releases', () => {
    const releases = [
      {
        version: 'ui@0.1.2',
        timestamp: sampleLatencyTimeSeries.data.at(2)?.timestamp,
      },
      {
        version: 'ui@0.1.3',
        timestamp: sampleLatencyTimeSeries.data.at(20)?.timestamp,
      },
    ].filter(hasTimestamp);

    return (
      <Fragment>
        <p>
          <JSXNode name="AreaChartWidget" /> supports the <code>releases</code> prop. If
          passed in, the widget will plot every release as a vertical line that overlays
          the chart data. Clicking on a release line will open the release details page.
        </p>

        <MediumWidget>
          <AreaChartWidget
            title="error_rate()"
            timeSeries={[sampleLatencyTimeSeries, sampleSpanDurationTimeSeries]}
            releases={releases}
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
