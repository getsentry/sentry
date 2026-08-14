import {OrganizationFixture} from 'sentry-fixture/organization';

import type {NavigationGroupProps} from 'sentry/views/settings/types';

import {getUserOrgNavigationConfiguration} from './userOrgNavigationConfiguration';

describe('getUserOrgNavigationConfiguration', () => {
  it('marks API Keys as permanently hidden (show: false)', () => {
    // SEC-551: the API Keys page is deprecated; it must never appear in the
    // settings sidebar or in cmd+k regardless of org access/features.
    const apiKeysItem = getUserOrgNavigationConfiguration()
      .flatMap(section => section.items)
      .find(item => item.id === 'api-keys');

    expect(apiKeysItem).toBeDefined();
    expect(apiKeysItem?.show).toBe(false);
  });

  it('shows Autofix instead of Issue Scans & Fixes with free access', () => {
    const organization = OrganizationFixture({features: []});
    const section = getUserOrgNavigationConfiguration().find(
      item => item.id === 'settings-seer'
    )!;
    const props: NavigationGroupProps = {
      ...section,
      hasFreeAutofixAccess: true,
      organization,
    };
    const legacyItem = section.items.find(item => item.id === 'seer-autofix-legacy')!;
    const autofixItem = section.items.find(item => item.id === 'seer-autofix-new')!;

    expect(typeof legacyItem.show === 'function' && legacyItem.show(props)).toBe(false);
    expect(typeof autofixItem.show === 'function' && autofixItem.show(props)).toBe(true);
  });
});
