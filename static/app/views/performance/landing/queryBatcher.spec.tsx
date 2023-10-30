import {Fragment} from 'react';

import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {GenericQueryBatcher} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {OrganizationContext} from 'sentry/views/organizationContext';
import WidgetContainer from 'sentry/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

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

function WrappedComponent({data, ...rest}) {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <MEPSettingProvider>
        <PerformanceDisplayProvider value={{performanceType: ProjectPerformanceType.ANY}}>
          <WidgetContainer
            chartHeight={100}
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
      </MEPSettingProvider>
    </OrganizationContext.Provider>
  );
}

describe('Performance > Widgets > Query Batching', function () {
  let eventsMock;
  let eventStatsMock;

  beforeEach(function () {
    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'tpm()': 53.12,
            'user_misery()': 0.023,
            'failure_rate()': 0.012,
          },
        ],
        meta: {
          isMetricsData: false,
        },
      },
    });

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

  it('EventsRequest and DiscoverQuery based component fires queries without provider', async function () {
    const data = initializeData();

    render(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
        isMEPEnabled={false}
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
    expect(eventsMock).toHaveBeenCalledTimes(1);
    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          statsPeriod: '7d',
          field: ['tpm()'],
        }),
      })
    );
  });

  it('Multiple EventsRequest and DiscoverQuery based components fire individual queries without provider', async function () {
    const data = initializeData();

    render(
      <Fragment>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
          isMEPEnabled={false}
        />
      </Fragment>,
      {
        organization: data.organization,
      }
    );

    expect(await screen.findAllByTestId('performance-widget-title')).toHaveLength(3);

    expect(eventStatsMock).toHaveBeenCalledTimes(3);
    expect(eventsMock).toHaveBeenCalledTimes(3);
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

  it('Multiple EventsRequest and DiscoverQuery based components merge queries with provider', async function () {
    const data = initializeData();

    render(
      <GenericQueryBatcher>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
          isMEPEnabled={false}
        />
      </GenericQueryBatcher>,
      {
        organization: data.organization,
      }
    );

    await waitFor(() => expect(eventStatsMock).toHaveBeenCalled());
    await waitFor(() => expect(eventsMock).toHaveBeenCalled());

    expect(eventsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: ['prod'],
          field: ['tpm()', 'failure_rate()', 'user_misery()'],
          statsPeriod: '7d',
        }),
      })
    );

    expect(eventsMock).toHaveBeenCalledTimes(1);

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

  it('Multiple EventsRequest and DiscoverQuery based components merge queries with provider and add MEP', async function () {
    const data = initializeData();

    render(
      <GenericQueryBatcher>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
          isMEPEnabled
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
          isMEPEnabled
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
          isMEPEnabled
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

    render(
      <GenericQueryBatcher>
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
          isMEPEnabled={false}
        />
        <WrappedComponent
          data={data}
          defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
          isMEPEnabled={false}
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
