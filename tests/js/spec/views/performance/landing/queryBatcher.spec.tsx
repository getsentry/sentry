import {Fragment} from 'react';

import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import {GenericQueryBatcher} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {PROJECT_PERFORMANCE_TYPE} from 'sentry/views/performance/utils';

const initializeData = () => {
  const data = _initializeData({
    query: {statsPeriod: '7d', environment: ['prod'], project: [-42]},
  });

  data.eventView.additionalConditions.addFilterValues('transaction.op', ['pageload']);

  return data;
};

const BASIC_QUERY_PARAMS = {
  interval: '1h',
  partial: '1',
  query: 'transaction.op:pageload',
  statsPeriod: '14d',
};

const WrappedComponent = ({data, ...rest}) => {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <WidgetContainer
        allowedCharts={[
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.FAILURE_RATE_AREA,
          PerformanceWidgetSetting.USER_MISERY_AREA,
        ]}
        rowChartSettings={[]}
        forceDefaultChartSetting
        {...data}
        {...rest}
      />
    </PerformanceDisplayProvider>
  );
};

describe('Performance > Widgets > Query Batching', function () {
  let eventStatsMock;

  beforeEach(function () {
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: {
        'tpm()': {
          data: [
            [
              1636822800,
              [
                {
                  count: 30.0,
                },
              ],
            ],
            [
              1636995600,
              [
                {
                  count: 60.1,
                },
              ],
            ],
          ],
          order: 1,
          start: 1636822800,
          end: 1636995600,
        },
        'user_misery()': {
          data: [
            [
              1636822800,
              [
                {
                  count: 0.02,
                },
              ],
            ],
            [
              1636995600,
              [
                {
                  count: 0.03,
                },
              ],
            ],
          ],
          order: 1,
          start: 1636822800,
          end: 1636995600,
        },
        'failure_rate()': {
          data: [
            [
              1636822800,
              [
                {
                  count: 0.002,
                },
              ],
            ],
            [
              1636995600,
              [
                {
                  count: 0.001,
                },
              ],
            ],
          ],
          order: 2,
          start: 1636822800,
          end: 1636995600,
        },
      },
    });
  });

  it('EventsRequest based component fires query without provider', async function () {
    const data = initializeData();

    mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />,
      {
        organization: data.organization,
      }
    );

    expect(await screen.findByTestId('performance-widget-title')).toBeInTheDocument();

    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          ...BASIC_QUERY_PARAMS,
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Multiple EventsRequest based components fire individual queries without provider', async function () {
    const data = initializeData();

    mountWithTheme(
      <Fragment>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
        />
      </Fragment>,
      {
        organization: data.organization,
      }
    );

    expect(await screen.findAllByTestId('performance-widget-title')).toHaveLength(3);

    // Three requests are made
    expect(eventStatsMock).toHaveBeenCalledTimes(3);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          ...BASIC_QUERY_PARAMS,
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Multiple EventsRequest based component merge queries with provider ', async function () {
    const data = initializeData();

    mountWithTheme(
      <GenericQueryBatcher>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
        />
      </GenericQueryBatcher>,
      {
        organization: data.organization,
      }
    );

    expect(await screen.findAllByTestId('performance-widget-title')).toHaveLength(3);

    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          ...BASIC_QUERY_PARAMS,
          yAxis: ['tpm()', 'failure_rate()', 'user_misery()'],
        }),
      })
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    expect(await screen.findAllByTestId('widget-state-has-data')).toHaveLength(3);
  });

  it('Errors work correctly', async function () {
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      statusCode: 404,
      body: {},
    });

    const data = initializeData();

    mountWithTheme(
      <GenericQueryBatcher>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
        />
      </GenericQueryBatcher>,
      {
        organization: data.organization,
      }
    );

    expect(await screen.findAllByTestId('performance-widget-title')).toHaveLength(3);

    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          ...BASIC_QUERY_PARAMS,
          yAxis: ['tpm()', 'failure_rate()', 'user_misery()'],
        }),
      })
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    expect(await screen.findAllByTestId('widget-state-is-errored')).toHaveLength(3);
  });
});
