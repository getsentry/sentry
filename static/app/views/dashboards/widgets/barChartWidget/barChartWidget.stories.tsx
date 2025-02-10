import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {TimeSeries} from '../common/types';
import {shiftTimeserieToNow} from '../timeSeriesWidget/shiftTimeserieToNow';

import {sampleLatencyTimeSeries} from './fixtures/sampleLatencyTimeSeries';
import {sampleSpanDurationTimeSeries} from './fixtures/sampleSpanDurationTimeSeries';
import {BarChartWidget} from './barChartWidget';

export default storyBook('BarChartWidget', story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BarChartWidget" /> is a Dashboard Widget Component. It displays a
          timeseries chart with multiple timeseries, and the timeseries and discontinuous.
          In all other ways, it behaves like <JSXNode name="AreaChartWidget" />
        </p>
        <p>
          <em>NOTE:</em> Prefer <JSXNode name="LineChartWidget" /> and{' '}
          <JSXNode name="AreaChartWidget" /> for timeseries visualizations! This should be
          used for discontinuous categorized data.
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
          The visualization of <JSXNode name="BarChartWidget" /> is a bar chart. It has
          some bells and whistles including automatic axes labels, and a hover tooltip.
          Like other widgets, it automatically fills the parent element.
        </p>
        <p>
          The <code>stacked</code> boolean prop controls stacking. Bar charts are not
          stacked by default.
        </p>
        <SideBySide>
          <SmallSizingWindow>
            <BarChartWidget
              title="Duration Breakdown"
              description="Explains what proportion of total duration is taken up by latency vs. span duration"
              timeSeries={[
                shiftTimeserieToNow(latencyTimeSeries),
                shiftTimeserieToNow(spanDurationTimeSeries),
              ]}
              dataCompletenessDelay={600}
            />
          </SmallSizingWindow>
          <SmallSizingWindow>
            <BarChartWidget
              title="Duration Breakdown"
              description="Explains what proportion of total duration is taken up by latency vs. span duration"
              timeSeries={[
                shiftTimeserieToNow(latencyTimeSeries),
                shiftTimeserieToNow(spanDurationTimeSeries),
              ]}
              stacked
            />
          </SmallSizingWindow>
        </SideBySide>
      </Fragment>
    );
  });
});

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
