import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeData} from 'sentry-test/performance/initializePerformanceData';

import {OrganizationContext} from 'app/views/organizationContext';
import WidgetContainer from 'app/views/performance/landing/widgets/components/widgetContainer';
import {PerformanceWidgetSetting} from 'app/views/performance/landing/widgets/widgetDefinitions';

const WrappedComponent = ({data, ...rest}) => {
  return (
    <OrganizationContext.Provider value={data.organization}>
      <WidgetContainer
        {...data}
        {...rest}
        allowedCharts={[
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.FAILURE_RATE_AREA,
          PerformanceWidgetSetting.USER_MISERY_AREA,
        ]}
        forceDefaultChartSetting
      />
    </OrganizationContext.Provider>
  );
};

describe('Performance > Widgets > WidgetContainer', function () {
  let eventStatsMock;
  let eventsV2Mock;
  beforeEach(function () {
    eventStatsMock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/events-stats/`,
      body: [],
    });
    eventsV2Mock = MockApiClient.addMockResponse({
      method: 'GET',
      url: `/organizations/org-slug/eventsv2/`,
      body: [],
    });
  });

  it('TPM Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.TPM_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Transactions Per Minute'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1d',
          partial: '1',
          project: [],
          query: '',
          statsPeriod: '28d',
          yAxis: 'tpm()',
        }),
      })
    );
  });

  it('Failure Rate Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1d',
          partial: '1',
          project: [],
          query: '',
          statsPeriod: '28d',
          yAxis: 'failure_rate()',
        }),
      })
    );
  });

  it('User misery Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.USER_MISERY_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'User Misery'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);
    expect(eventStatsMock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1d',
          partial: '1',
          project: [],
          query: '',
          statsPeriod: '28d',
          yAxis: 'user_misery()',
        }),
      })
    );
  });

  it('LCP Histogram Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.LCP_HISTOGRAM}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'LCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('FCP Histogram Widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FCP_HISTOGRAM}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'FCP Distribution'
    );

    // TODO(k-fish): Add histogram mock
  });

  it('Most errors widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ERRORS}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Related Errors'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['transaction', 'project.id', 'failure_count()'],
          per_page: 3,
          project: [],
          query: '',
          sort: '-failure_count()',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('Most related issues widget', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.MOST_RELATED_ISSUES}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Most Related Issues'
    );
    expect(eventsV2Mock).toHaveBeenCalledTimes(1);
    expect(eventsV2Mock).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          field: ['issue', 'transaction', 'title', 'project.id', 'count()'],
          per_page: 3,
          project: [],
          query: 'event.type:error !tags[transaction]:""',
          sort: '-count()',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('Able to change widget type from menu', async function () {
    const data = initializeData();

    const wrapper = mountWithTheme(
      <WrappedComponent
        data={data}
        defaultChartSetting={PerformanceWidgetSetting.FAILURE_RATE_AREA}
      />,
      data.routerContext
    );
    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'Failure Rate'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(1);

    wrapper.find('IconEllipsis[data-test-id="context-menu"]').simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('MenuItem').at(2).text()).toEqual('User Misery');
    wrapper.find('MenuItem').at(2).simulate('click');

    await tick();
    wrapper.update();

    expect(wrapper.find('div[data-test-id="performance-widget-title"]').text()).toEqual(
      'User Misery'
    );
    expect(eventStatsMock).toHaveBeenCalledTimes(2);
  });
});
