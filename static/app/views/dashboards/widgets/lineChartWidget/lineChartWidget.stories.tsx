import {Fragment} from 'react';
import styled from '@emotion/styled';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';

import type {TimeseriesData} from '../common/types';

import {LineChartWidget} from './lineChartWidget';
import sampleDurationTimeSeries from './sampleDurationTimeSeries.json';
import sampleThroughputTimeSeries from './sampleThroughputTimeSeries.json';

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
    return (
      <Fragment>
        <p>
          The visualization of <JSXNode name="LineChartWidget" /> a line chart. It has
          some bells and whistles including automatic axes labels, and a hover tooltip.
        </p>

        <SideBySide>
          <MediumWidget>
            <LineChartWidget
              title="eps()"
              description="Number of events per second"
              timeseries={[sampleThroughputTimeSeries as unknown as TimeseriesData]}
              meta={{
                fields: {
                  'eps()': 'rate',
                },
                units: {
                  'eps()': '1/second',
                },
              }}
            />
          </MediumWidget>

          <MediumWidget>
            <LineChartWidget
              title="span.duration"
              timeseries={[
                sampleDurationTimeSeries as unknown as TimeseriesData,
                sampleDurationTimeSeries2 as unknown as TimeseriesData,
              ]}
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
});

const MediumWidget = styled('div')`
  width: 420px;
`;
