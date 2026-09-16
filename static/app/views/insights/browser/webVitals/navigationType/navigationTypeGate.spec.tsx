import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {DashboardFilterKeys, WidgetType} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import {NavigationTypeGate} from 'sentry/views/insights/browser/webVitals/navigationType/navigationTypeGate';
import {
  buildNavigationTypeGlobalFilter,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NavigationTypeBucket,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {navigationTypeSuppressesThresholds} from 'sentry/views/insights/browser/webVitals/navigationType/utils';
import {SpanFields} from 'sentry/views/insights/types';

describe('NavigationTypeGate', () => {
  const organization = OrganizationFixture({
    features: ['insights-web-vitals-navigation-type-switcher'],
  });

  function mockCounts(
    rows: Array<{'browser.navigation.type': string; 'count()': number}>
  ) {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: rows, meta: {fields: {}}},
    });
  }

  function renderGate(buckets: NavigationTypeBucket[]) {
    return render(
      <NavigationTypeGate prebuiltId={PrebuiltDashboardId.WEB_VITALS}>
        <div>widget grid</div>
      </NavigationTypeGate>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/6/',
            query: {
              globalFilter: [JSON.stringify(buildNavigationTypeGlobalFilter(buckets))],
            },
          },
        },
      }
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  it('renders the dashboard untouched on page loads', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 10}]);

    renderGate([NavigationTypeBucket.PAGE_LOAD]);

    expect(await screen.findByText('widget grid')).toBeInTheDocument();
    expect(screen.queryByText(/not comparable to page loads/)).not.toBeInTheDocument();
  });

  it('explains an empty selection instead of rendering charts', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 10}]);

    renderGate([NavigationTypeBucket.SOFT_NAVIGATION]);

    expect(await screen.findByText(/Chromium 151/)).toBeInTheDocument();
    expect(screen.queryByText('widget grid')).not.toBeInTheDocument();
  });

  it('flags that thresholds do not transfer outside page loads', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'bfcache', 'count()': 42}]);

    renderGate([NavigationTypeBucket.BFCACHE]);

    expect(await screen.findByText(/not comparable to page loads/)).toBeInTheDocument();
    expect(screen.getByText('widget grid')).toBeInTheDocument();
  });

  it('calls out a mixed selection as a blend', async () => {
    mockCounts([
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 100},
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'bfcache', 'count()': 42},
    ]);

    renderGate([NavigationTypeBucket.PAGE_LOAD, NavigationTypeBucket.BFCACHE]);

    expect(
      await screen.findByText(/is a blend rather than one measurement/)
    ).toBeInTheDocument();
    expect(screen.getByText('widget grid')).toBeInTheDocument();
  });

  it('says "All" is the pre-existing blend', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 100}]);

    renderGate(NAVIGATION_TYPE_BUCKET_ORDER);

    expect(
      await screen.findByText(
        /the blend the dashboard showed before this control existed/
      )
    ).toBeInTheDocument();
  });

  it('does nothing, and queries nothing, outside the web vitals dashboards', async () => {
    render(
      <NavigationTypeGate prebuiltId={PrebuiltDashboardId.HTTP}>
        <div>other grid</div>
      </NavigationTypeGate>,
      {organization}
    );

    expect(await screen.findByText('other grid')).toBeInTheDocument();
  });

  describe('navigationTypeSuppressesThresholds', () => {
    function filtersFor(buckets: NavigationTypeBucket[]) {
      return {
        [DashboardFilterKeys.GLOBAL_FILTER]: [buildNavigationTypeGlobalFilter(buckets)],
      };
    }

    it('keeps thresholds for a page loads only selection', () => {
      expect(
        navigationTypeSuppressesThresholds(filtersFor([NavigationTypeBucket.PAGE_LOAD]))
      ).toBe(false);
    });

    it('drops thresholds for any blend, including "All"', () => {
      expect(
        navigationTypeSuppressesThresholds(
          filtersFor([NavigationTypeBucket.PAGE_LOAD, NavigationTypeBucket.BFCACHE])
        )
      ).toBe(true);
      expect(
        navigationTypeSuppressesThresholds(filtersFor(NAVIGATION_TYPE_BUCKET_ORDER))
      ).toBe(true);
    });

    it('leaves dashboards without a navigation type filter alone', () => {
      expect(navigationTypeSuppressesThresholds(undefined)).toBe(false);
      expect(
        navigationTypeSuppressesThresholds({
          [DashboardFilterKeys.GLOBAL_FILTER]: [
            {
              dataset: WidgetType.SPANS,
              tag: {key: 'browser.name', name: 'browser.name'},
              value: 'browser.name:Chrome',
            },
          ],
        })
      ).toBe(false);
    });
  });
});
