import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

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
        </p>

        <SideBySide>
          <MediumWidget>
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
          </MediumWidget>

          <MediumWidget>
            <LineChartWidget
              title="span.duration"
              timeseries={[durationTimeSeries1, durationTimeSeries2]}
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
});

const MediumWidget = styled('div')`
  width: 420px;
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
