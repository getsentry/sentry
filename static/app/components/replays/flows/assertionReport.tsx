import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Flex} from 'sentry/components/core/layout/flex';
import {RateUnit} from 'sentry/utils/discover/fields';
import type {AssertionAction, AssertionFlow} from 'sentry/utils/replays/assertions/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {sampleDurationTimeSeries} from 'sentry/views/dashboards/widgets/timeSeriesWidget/fixtures/sampleDurationTimeSeries';
import {Area} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/area';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';

const IS_EMPTY = false;

const replaysSuccess: TimeSeries = {
  yAxis: 'replays(success)',
  meta: {
    valueType: 'integer',
    valueUnit: RateUnit.PER_SECOND,
    interval: 1_800_000, // 30 minutes
  },
  values: sampleDurationTimeSeries.values.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.3 + 30 * Math.random() : null,
    };
  }),
};

const replaysTimeout: TimeSeries = {
  yAxis: 'replays(timeout)',
  meta: {
    valueType: 'integer',
    valueUnit: RateUnit.PER_SECOND,
    interval: 1_800_000, // 30 minutes
  },
  values: sampleDurationTimeSeries.values.map(datum => {
    return {
      ...datum,
      value: datum.value ? datum.value * 0.1 + 30 * Math.random() : null,
    };
  }),
};

function getCategoryOrOp(action: AssertionAction): string {
  if ('op' in action) {
    return action.op;
  }
  if ('category' in action) {
    return action.category;
  }
  return 'null';
}

export default function AssertionReport({flow}: {flow: AssertionFlow}) {
  const theme = useTheme();

  const endings = useMemo(() => {
    const endingTS = flow.ending_actions.map(action => {
      const ending: TimeSeries = {
        meta: {
          valueType: 'integer',
          valueUnit: RateUnit.PER_SECOND,
          interval: 1_800_000, // 30 minutes
        },
        yAxis: `action.${getCategoryOrOp(action)}(${JSON.stringify(action.matcher)})`,
        values: sampleDurationTimeSeries.values.map(datum => {
          return {
            ...datum,
            value: datum.value ? datum.value * 0.3 + 30 * Math.random() : null,
          };
        }),
      };
      return ending;
    });

    endingTS.push({
      meta: {
        valueType: 'integer',
        valueUnit: RateUnit.PER_SECOND,
        interval: 1_800_000, // 30 minutes
      },
      yAxis: `action.timeout(${flow.timeout})`,
      values: sampleDurationTimeSeries.values.map(datum => {
        return {
          ...datum,
          value: datum.value ? datum.value * 0.6 + 30 * Math.random() : null,
        };
      }),
    });

    return endingTS;
  }, [flow.ending_actions]);

  return (
    <Fragment>
      <Flex
        background="primary"
        border="primary"
        direction="column"
        gap="3xl"
        padding="md"
        radius="lg"
        width="100%"
        height="300px"
      >
        <Flex direction="column" flex="1">
          <h4>Endings</h4>
          {IS_EMPTY ? (
            <p>No Data</p>
          ) : (
            <TimeSeriesWidgetVisualization
              height={1600}
              plottables={endings.map(ending => new Area(ending))}
            />
          )}
        </Flex>
      </Flex>
      <Flex
        background="primary"
        border="primary"
        direction="column"
        gap="3xl"
        padding="md"
        radius="lg"
        width="100%"
        height="300px"
      >
        <Flex direction="column" flex="1">
          <h4>Replays</h4>
          {IS_EMPTY ? (
            <p>No Data</p>
          ) : (
            <TimeSeriesWidgetVisualization
              height={1600}
              plottables={[
                new Area(replaysSuccess, {
                  color: theme.success,
                }),
                new Area(replaysTimeout, {
                  color: theme.error,
                }),
              ]}
            />
          )}
        </Flex>
      </Flex>
    </Fragment>
  );
}
