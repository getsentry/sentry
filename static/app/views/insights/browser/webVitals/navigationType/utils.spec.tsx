import {OrganizationFixture} from 'sentry-fixture/organization';

import {WEB_VITALS_NAVIGATION_TYPE_FILTER} from 'sentry/views/dashboards/utils/prebuiltConfigs/webVitals/webVitals';
import {
  buildNavigationTypeGlobalFilter,
  NavigationTypeBucket,
  WEB_VITALS_NAVIGATION_TYPE_FEATURE,
} from 'sentry/views/insights/browser/webVitals/navigationType/settings';
import {hidesNavigationTypeChip} from 'sentry/views/insights/browser/webVitals/navigationType/utils';

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
