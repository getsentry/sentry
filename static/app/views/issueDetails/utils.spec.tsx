import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import type {Organization} from 'sentry/types/organization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';
import {OrganizationContext} from 'sentry/views/organizationContext';

const contextWrapper = (organization: Organization) => {
  return function ({children}: {children: React.ReactNode}) {
    return <OrganizationContext value={organization}>{children}</OrganizationContext>;
  };
};

describe('useHasStreamlinedUI', () => {
  it('respects the user preferences', () => {
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: userPrefersStreamline} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(OrganizationFixture({streamlineOnly: null})),
    });
    expect(userPrefersStreamline.current).toBe(true);

    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));
    const {result: userPrefersLegacy} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(OrganizationFixture({streamlineOnly: null})),
    });
    expect(userPrefersLegacy.current).toBe(false);
  });

  it('ignores preferences if enforce flag is set and user has not opted out', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
      streamlineOnly: null,
    });

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = null;
    act(() => ConfigStore.set('user', user));

    const {result} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(enforceOrg),
    });
    expect(result.current).toBe(true);
  });

  it('respects preferences if enforce flag is set and user has opted out', () => {
    const enforceOrg = OrganizationFixture({
      features: ['issue-details-streamline-enforce'],
      streamlineOnly: null,
    });

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const {result} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(enforceOrg),
    });
    expect(result.current).toBe(false);
  });

  it('ignores preferences if organization option is set to true', () => {
    const streamlineOrg = OrganizationFixture({streamlineOnly: true});

    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = false;
    act(() => ConfigStore.set('user', user));

    const {result: streamlineResult} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(streamlineOrg),
    });
    expect(streamlineResult.current).toBe(true);

    const legacyOrg = OrganizationFixture({streamlineOnly: false});

    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: legacyResult} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(legacyOrg),
    });
    expect(legacyResult.current).toBe(true);
  });

  it('ignores the option if unset', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    const {result: result} = renderHook(useHasStreamlinedUI, {
      wrapper: contextWrapper(OrganizationFixture({streamlineOnly: null})),
    });
    expect(result.current).toBe(true);
  });
});
