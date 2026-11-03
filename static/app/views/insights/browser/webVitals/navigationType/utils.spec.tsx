import {OrganizationFixture} from 'sentry-fixture/organization';

import {WidgetType} from 'sentry/views/dashboards/types';
import {WEB_VITALS_NAVIGATION_TYPE_FILTER} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';
import {
  buildNavigationTypeGlobalFilter,
  getNavigationTypeCountsDataset,
  getNavigationTypeDatasets,
  NAVIGATION_TYPE_BUCKET_ORDER,
  NavigationTypeBucket,
  WEB_VITALS_NAVIGATION_TYPE_FEATURE,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {
  hidesNavigationTypeChip,
  showsNavigationTypeSwitcher,
} from 'sentry/views/insights/browser/webVitals/navigationType/utils';

describe('hidesNavigationTypeChip', () => {
  const withFlag = OrganizationFixture({features: [WEB_VITALS_NAVIGATION_TYPE_FEATURE]});
  const withoutFlag = OrganizationFixture();

  // A chip that actually filters, e.g. one picked by hand on a duplicate.
  const {isTemporary: _, ...activeChip} = buildNavigationTypeGlobalFilter([
    NavigationTypeBucket.BFCACHE,
  ]);

  it('hides the chip where the switcher replaces it', () => {
    expect(
      hidesNavigationTypeChip(WEB_VITALS_NAVIGATION_TYPE_FILTER, withFlag, true)
    ).toBe(true);
    expect(
      hidesNavigationTypeChip(
        buildNavigationTypeGlobalFilter(
          NAVIGATION_TYPE_BUCKET_ORDER,
          WidgetType.TRACEMETRICS
        ),
        withFlag,
        true
      )
    ).toBe(true);
  });

  it('shows the chip on a duplicated dashboard when the flag is on', () => {
    expect(
      hidesNavigationTypeChip(WEB_VITALS_NAVIGATION_TYPE_FILTER, withFlag, false)
    ).toBe(false);
  });

  it('hides the empty prebuilt default from orgs without the flag', () => {
    expect(
      hidesNavigationTypeChip(WEB_VITALS_NAVIGATION_TYPE_FILTER, withoutFlag, false)
    ).toBe(true);
  });

  it('never hides a chip that is actually filtering', () => {
    expect(hidesNavigationTypeChip(activeChip, withoutFlag, false)).toBe(false);
  });

  it('leaves other filters alone', () => {
    expect(
      hidesNavigationTypeChip(
        {
          ...WEB_VITALS_NAVIGATION_TYPE_FILTER,
          tag: {key: 'browser.name', name: 'browser.name'},
        },
        withoutFlag,
        false
      )
    ).toBe(false);
  });
});

describe('showsNavigationTypeSwitcher', () => {
  const withFlag = OrganizationFixture({features: [WEB_VITALS_NAVIGATION_TYPE_FEATURE]});
  const withoutFlag = OrganizationFixture();

  it('always shows on the web vitals dashboards', () => {
    expect(showsNavigationTypeSwitcher([], withFlag, true)).toBe(true);
  });

  it('shows on a copy that carries the filter', () => {
    expect(
      showsNavigationTypeSwitcher([WEB_VITALS_NAVIGATION_TYPE_FILTER], withFlag, false)
    ).toBe(true);
  });

  it('shows on a metrics backed copy that carries the filter', () => {
    expect(
      showsNavigationTypeSwitcher(
        [
          buildNavigationTypeGlobalFilter(
            NAVIGATION_TYPE_BUCKET_ORDER,
            WidgetType.TRACEMETRICS
          ),
        ],
        withFlag,
        false
      )
    ).toBe(true);
  });

  it('stays off on a dashboard without the filter', () => {
    expect(showsNavigationTypeSwitcher([], withFlag, false)).toBe(false);
  });

  it('stays off for a hand-picked value it cannot represent', () => {
    expect(
      showsNavigationTypeSwitcher(
        [
          {
            ...WEB_VITALS_NAVIGATION_TYPE_FILTER,
            value: 'browser.navigation.type:[navigate]',
          },
        ],
        withFlag,
        false
      )
    ).toBe(false);
  });

  it('stays off without the flag', () => {
    expect(
      showsNavigationTypeSwitcher([WEB_VITALS_NAVIGATION_TYPE_FILTER], withoutFlag, true)
    ).toBe(false);
  });
});

describe('getNavigationTypeDatasets', () => {
  const spansFilter = WEB_VITALS_NAVIGATION_TYPE_FILTER;
  const metricsFilter = buildNavigationTypeGlobalFilter(
    NAVIGATION_TYPE_BUCKET_ORDER,
    WidgetType.TRACEMETRICS
  );

  it('falls back to spans for a dashboard without the filter', () => {
    expect(getNavigationTypeDatasets([])).toEqual([WidgetType.SPANS]);
    expect(getNavigationTypeDatasets(undefined)).toEqual([WidgetType.SPANS]);
  });

  it('reads the datasets from the filters the dashboard carries', () => {
    expect(getNavigationTypeDatasets([metricsFilter])).toEqual([WidgetType.TRACEMETRICS]);
    expect(getNavigationTypeDatasets([metricsFilter, spansFilter])).toEqual([
      WidgetType.SPANS,
      WidgetType.TRACEMETRICS,
    ]);
  });

  it('counts on the metrics whenever the dashboard is metrics backed', () => {
    expect(getNavigationTypeCountsDataset([WidgetType.SPANS])).toBe(WidgetType.SPANS);
    expect(
      getNavigationTypeCountsDataset([WidgetType.SPANS, WidgetType.TRACEMETRICS])
    ).toBe(WidgetType.TRACEMETRICS);
  });
});
