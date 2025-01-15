import {Fragment} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {TimeseriesData} from '../common/types';

import {BarChartWidget} from './barChartWidget';
import sampleLatencyTimeSeries from './sampleLatencyTimeSeries.json';
import sampleSpanDurationTimeSeries from './sampleSpanDurationTimeSeries.json';

export default storyBook(BarChartWidget, story => {
  story('Getting Started', () => {
    return (
      <Fragment>
        <p>
          <JSXNode name="BarChartWidget" /> is a Dashboard Widget Component. It displays a
          timeseries chart with multiple timeseries, and the timeseries are stacked and
          discontinuous. In all other ways, it behaves like{' '}
          <JSXNode name="AreaChartWidget" />
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

    const latencyTimeSeries = toTimeSeriesSelection(
      sampleLatencyTimeSeries as unknown as TimeseriesData,
      start,
      end
    );

    const spanDurationTimeSeries = toTimeSeriesSelection(
      sampleSpanDurationTimeSeries as unknown as TimeseriesData,
      start,
      end
    );

    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="BarChartWidget" /> is a stacked bar chart.
          It has some bells and whistles including automatic axes labels, and a hover
          tooltip. Like other widgets, it automatically fills the parent element.
        </p>
        <SmallSizingWindow>
          <BarChartWidget
            title="Duration Breakdown"
            description="Explains what proportion of total duration is taken up by latency vs. span duration"
            timeseries={[latencyTimeSeries, spanDurationTimeSeries]}
          />
        </SmallSizingWindow>
      </Fragment>
    );
  });
});

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
