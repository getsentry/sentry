import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import SideBySide from 'sentry/components/stories/sideBySide';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import type {DateString} from 'sentry/types/core';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {Release, TimeSeries, TimeseriesSelection} from '../common/types';
import {shiftTimeserieToNow} from '../timeSeriesWidget/shiftTimeserieToNow';

import {sampleDurationTimeSeries} from './fixtures/sampleDurationTimeSeries';
import {sampleThroughputTimeSeries} from './fixtures/sampleThroughputTimeSeries';
import {LineChartWidget} from './lineChartWidget';

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

const sectionSize = sampleThroughputTimeSeries.data.length / 10;
const sectionStart = sectionSize * 2;
const sectionEnd = sectionSize * 3;
const sparseThroughputTimeSeries = {
  ...sampleThroughputTimeSeries,
  data: sampleThroughputTimeSeries.data.map((datum, index) => {
    if (index > sectionStart && index < sectionEnd) {
      return {
        ...datum,
        value: null,
      };
    }
    return datum;
  }),
};

export default storyBook('LineChartWidget', story => {
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

    const [timeseriesSelection, setTimeseriesSelection] = useState<TimeseriesSelection>({
      'p50(span.duration)': true,
      'p99(span.duration)': true,
    });

    const toggleTimeseriesSelection = (seriesName: string): void => {
      setTimeseriesSelection(s => ({...s, [seriesName]: !s[seriesName]}));
    };

    const throughputTimeSeries = toTimeSeriesSelection(
      sparseThroughputTimeSeries,
      start,
      end
    );

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
          The visualization of <JSXNode name="LineChartWidget" /> a line chart. It has
          some bells and whistles including automatic axes labels, and a hover tooltip.
          Like other widgets, it automatically fills the parent element. <code>null</code>{' '}
          values are supported!
        </p>
        <SmallSizingWindow>
          <LineChartWidget
            title="eps()"
            description="Number of events per second"
            timeSeries={[toTimeSeriesSelection(throughputTimeSeries, start, end)]}
          />
        </SmallSizingWindow>

        <p>
          The <code>dataCompletenessDelay</code> prop indicates that this data is live,
          and the last few buckets might not have complete data. The delay is a number in
          seconds. Any data bucket that happens in that delay window will be plotted with
          a dotted line. By default the delay is <code>0</code>.
        </p>

        <p>
          To control the timeseries selection, you can use the{' '}
          <code>timeseriesSelection</code> and <code>onTimeseriesSelectionChange</code>{' '}
          props.
        </p>

        <SideBySide>
          <MediumWidget>
            <LineChartWidget
              title="span.duration"
              dataCompletenessDelay={60 * 60 * 3}
              timeSeries={[
                shiftTimeserieToNow(durationTimeSeries1),
                shiftTimeserieToNow(durationTimeSeries2),
              ]}
              aliases={{
                'p50(span.duration)': '50th Percentile',
                'p99(span.duration)': '99th Percentile',
              }}
              timeseriesSelection={timeseriesSelection}
              onTimeseriesSelectionChange={newSelection => {
                setTimeseriesSelection(newSelection);
              }}
            />
          </MediumWidget>

          <Button
            onClick={() => {
              toggleTimeseriesSelection('p50(span.duration)');
            }}
          >
            Toggle 50th Percentile
          </Button>

          <Button
            onClick={() => {
              toggleTimeseriesSelection('p99(span.duration)');
            }}
          >
            Toggle 99th Percentile
          </Button>
        </SideBySide>

        <p>
          <JSXNode name="LineChartWidget" /> will automatically check the types and unit
          of all the incoming timeseries. If they do not all match, it will fall back to a
          plain number scale. If the types match but the units do not, it will fall back
          to a sensible unit
        </p>

        <MediumWidget>
          <LineChartWidget
            title="span.duration"
            timeSeries={[
              {
                ...durationTimeSeries1,
                meta: {
                  fields: durationTimeSeries1.meta?.fields!,
                  units: {
                    'p99(span.duration)': 'millisecond',
                  },
                },
              },
              {
                ...durationTimeSeries2,
                data: durationTimeSeries2.data.map(datum => ({
                  ...datum,
                  value: datum.value === null ? null : datum.value / 1000,
                })),
                meta: {
                  fields: durationTimeSeries2.meta?.fields!,
                  units: {
                    'p50(span.duration)': 'second',
                  },
                },
              },
            ]}
          />
        </MediumWidget>
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
            timeSeries={[
              {
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
                color: theme.error,
              },
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
            timeSeries={[
              {
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
              },
            ]}
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
