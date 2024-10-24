import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';

import {DashboardsMEPContext} from './widgetCard/dashboardsMEPContext';
import {IndexedEventsSelectionAlert} from './indexedEventsSelectionAlert';
import {WidgetType} from './types';

describe('IndexedEventsSelectionAlert', () => {
  const widget = WidgetFixture({
    widgetType: WidgetType.DISCOVER,
  });

  it('Shows warning if falling through to indexed events', async () => {
    render(
      <MEPSettingProvider forceTransactions>
        <DashboardsMEPContext.Provider
          value={{isMetricsData: false, setIsMetricsData: () => {}}}
        >
          <IndexedEventsSelectionAlert widget={widget} />
        </DashboardsMEPContext.Provider>
      </MEPSettingProvider>
    );

    await screen.findByText(/we've automatically adjusted your results/i);
  });

  it('Does not show warning if using metrics successfully', () => {
    render(
      <MEPSettingProvider>
        <DashboardsMEPContext.Provider
          value={{isMetricsData: true, setIsMetricsData: () => {}}}
        >
          <IndexedEventsSelectionAlert widget={widget} />
        </DashboardsMEPContext.Provider>
      </MEPSettingProvider>
    );

    expect(
      screen.queryByText(/we've automatically adjusted your results/i)
    ).not.toBeInTheDocument();
  });
});
