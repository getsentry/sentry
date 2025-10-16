import {Fragment} from 'react';

import {initializeData as _initializeData} from 'sentry-test/performance/initializePerformanceData';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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

function WrappedComponent({data, ...rest}: any) {
  return (
    <OrganizationContext value={data.organization}>
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
    </OrganizationContext>
  );
}

describe('Performance > Widgets > Query Batching', () => {
  let eventsMock: jest.Mock;
  let eventStatsMock: jest.Mock;

  beforeEach(() => {
    eventsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/organizations/org-slug/events/',
      body: {
        data: [
          {
            'epm()': 53.12,
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
        'epm()': {
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

  it('EventsRequest and DiscoverQuery based component fires queries without provider', async () => {
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
          yAxis: 'epm()',
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
          field: ['epm()'],
        }),
      })
    );
  });

  it('Multiple EventsRequest and DiscoverQuery based components fire individual queries without provider', async () => {
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
          yAxis: 'epm()',
        }),
      })
    );
  });
});
