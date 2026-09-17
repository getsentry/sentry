import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {NavigationTypeSwitcher} from 'sentry/views/insights/browser/webVitals/navigationType/navigationTypeSwitcher';
import {
  buildNavigationTypeGlobalFilter,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NavigationTypeBucket,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {SpanFields} from 'sentry/views/insights/types';

describe('NavigationTypeSwitcher', () => {
  const organization = OrganizationFixture();

  function mockCounts(
    rows: Array<{'browser.navigation.type': string; 'count()': number}>
  ) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: rows, meta: {fields: {}}},
    });
  }

  function renderSwitcher(
    globalFilters: GlobalFilter[],
    onChange: (filters: GlobalFilter[]) => void = jest.fn()
  ) {
    return render(
      <NavigationTypeSwitcher globalFilters={globalFilters} onChange={onChange} />,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  it('defaults to all navigation types and writes the filter out', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: '', 'count()': 500}]);
    const onChange = jest.fn();

    renderSwitcher([], onChange);

    expect(screen.getByText('All')).toBeInTheDocument();
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        buildNavigationTypeGlobalFilter(NAVIGATION_TYPE_BUCKET_ORDER),
      ]);
    });
  });

  it('shows a count for every bucket, including empty ones', async () => {
    mockCounts([
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 1200},
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'back-forward-cache', 'count()': 3},
    ]);

    renderSwitcher([buildNavigationTypeGlobalFilter([NavigationTypeBucket.PAGE_LOAD])]);

    await userEvent.click(screen.getByRole('button', {name: /Measured on/}));

    expect(await screen.findByRole('option', {name: /Page loads/})).toHaveTextContent(
      '1.2K'
    );
    expect(screen.getByRole('option', {name: /bfcache restores/})).toHaveTextContent('3');

    // Empty buckets show a zero plus the reason they're likely empty.
    const softNav = screen.getByRole('option', {name: /Soft navigations/});
    expect(softNav).toHaveTextContent('0');
    expect(softNav).toHaveTextContent(/Chromium 151/);
  });

  it('counts spans without the attribute as page loads and says so', async () => {
    mockCounts([
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: '', 'count()': 900},
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 100},
    ]);

    renderSwitcher([buildNavigationTypeGlobalFilter([NavigationTypeBucket.PAGE_LOAD])]);

    await userEvent.click(screen.getByRole('button', {name: /Measured on/}));

    expect(await screen.findByRole('option', {name: /Page loads/})).toHaveTextContent(
      '1K'
    );
    expect(screen.getByText(/spans have no navigation type/)).toBeInTheDocument();
  });

  it('adds a bucket to the selection without dropping the other filters', async () => {
    mockCounts([
      {[SpanFields.BROWSER_NAVIGATION_TYPE]: 'back-forward-cache', 'count()': 10},
    ]);
    const onChange = jest.fn();
    const browserFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'browser.name'},
      value: 'browser.name:Chrome',
    };

    renderSwitcher(
      [browserFilter, buildNavigationTypeGlobalFilter([NavigationTypeBucket.PAGE_LOAD])],
      onChange
    );

    await userEvent.click(screen.getByRole('button', {name: /Measured on/}));
    await userEvent.click(await screen.findByRole('option', {name: /bfcache restores/}));

    expect(onChange).toHaveBeenCalledWith([
      browserFilter,
      buildNavigationTypeGlobalFilter([
        NavigationTypeBucket.PAGE_LOAD,
        NavigationTypeBucket.BFCACHE,
      ]),
    ]);
  });

  it('unions the selected buckets into one query, keeping untagged spans with page loads', () => {
    expect(
      buildNavigationTypeGlobalFilter([
        NavigationTypeBucket.PAGE_LOAD,
        NavigationTypeBucket.BFCACHE,
      ]).value
    ).toBe(
      '(browser.navigation.type:[navigate,reload,back-forward,restore,back-forward-cache] OR !has:browser.navigation.type)'
    );

    expect(
      buildNavigationTypeGlobalFilter([
        NavigationTypeBucket.BFCACHE,
        NavigationTypeBucket.PRERENDER,
      ]).value
    ).toBe('browser.navigation.type:[back-forward-cache,prerender]');
  });

  it('reads "All" and filters nothing when everything is selected', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 10}]);

    const allFilter = buildNavigationTypeGlobalFilter(NAVIGATION_TYPE_BUCKET_ORDER);
    expect(allFilter.value).toBe('');

    renderSwitcher([allFilter]);

    expect(await screen.findByText('All')).toBeInTheDocument();
  });

  it('treats deselecting the last bucket as "All"', async () => {
    mockCounts([{[SpanFields.BROWSER_NAVIGATION_TYPE]: 'navigate', 'count()': 10}]);
    const onChange = jest.fn();

    renderSwitcher(
      [buildNavigationTypeGlobalFilter([NavigationTypeBucket.PAGE_LOAD])],
      onChange
    );

    await userEvent.click(screen.getByRole('button', {name: /Measured on/}));
    await userEvent.click(await screen.findByRole('option', {name: /Page loads/}));

    expect(onChange).toHaveBeenCalledWith([
      buildNavigationTypeGlobalFilter(NAVIGATION_TYPE_BUCKET_ORDER),
    ]);
  });
});
