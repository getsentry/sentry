import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {WidgetType} from 'sentry/views/dashboards/types';

import {useDashboardMaxPickableDays} from './useDashboardMaxPickableDays';

describe('useDashboardMaxPickableDays', () => {
  const traceMetricsWidgets = [WidgetFixture({widgetType: WidgetType.TRACEMETRICS})];

  it('caps trace metrics dashboards at 30 days without the flag', () => {
    const {result} = renderHookWithProviders(
      () => useDashboardMaxPickableDays(traceMetricsWidgets),
      {organization: OrganizationFixture({features: []})}
    );

    expect(result.current.maxPickableDays).toBe(30);
  });

  it('allows 90 days on trace metrics dashboards with the flag', () => {
    const {result} = renderHookWithProviders(
      () => useDashboardMaxPickableDays(traceMetricsWidgets),
      {
        organization: OrganizationFixture({
          features: ['dashboards-tracemetrics-90-day-range'],
        }),
      }
    );

    expect(result.current.maxPickableDays).toBe(90);
    expect(result.current.maxUpgradableDays).toBe(90);
  });

  it('does not change dashboards without trace metrics widgets', () => {
    const {result} = renderHookWithProviders(
      () => useDashboardMaxPickableDays([WidgetFixture({widgetType: WidgetType.LOGS})]),
      {
        organization: OrganizationFixture({
          features: ['dashboards-tracemetrics-90-day-range'],
        }),
      }
    );

    expect(result.current.maxPickableDays).toBe(30);
  });
});
