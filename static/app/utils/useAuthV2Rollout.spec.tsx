import Cookies from 'js-cookie';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useAuthV2Rollout} from 'sentry/utils/useAuthV2Rollout';
import {AuthV2CookieState, useEnableAuthV2} from 'sentry/utils/useEnableAuthV2';

const AUTH_V2_ROLLOUT_ORGANIZATION = 'sentry_react_auth_rollout_organization';

function getRolloutOrganization(): string | null {
  return JSON.parse(localStorage.getItem(AUTH_V2_ROLLOUT_ORGANIZATION) ?? 'null') as
    | string
    | null;
}

function setRolloutOrganization(organizationSlug: string) {
  localStorage.setItem(AUTH_V2_ROLLOUT_ORGANIZATION, JSON.stringify(organizationSlug));
}

describe('useAuthV2Rollout', () => {
  beforeEach(() => {
    OrganizationStore.init();
    Cookies.remove('sentry_react_auth', {path: '/'});
    localStorage.removeItem(AUTH_V2_ROLLOUT_ORGANIZATION);
  });

  it('enables Auth V2 when a member organization has the rollout feature', async () => {
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onUpdate(
        OrganizationFixture({slug: 'rollout-org', features: ['authv2-rollout']})
      );
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('1'));
    expect(getRolloutOrganization()).toBe('rollout-org');
  });

  it('preserves an explicit opt-out while the organization has the rollout feature', async () => {
    Cookies.set('sentry_react_auth', '0', {path: '/'});
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onUpdate(OrganizationFixture({features: ['authv2-rollout']}));
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('0'));
  });

  it('preserves cookie state when organization loading fails', async () => {
    Cookies.set('sentry_react_auth', '1', {path: '/'});
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onFetchOrgError(
        new RequestError('GET', '/api/0/organizations/acme/', new Error('network error'))
      );
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('1'));
  });

  it('preserves an explicit opt-out outside the rollout', async () => {
    Cookies.set('sentry_react_auth', '0', {path: '/'});
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onUpdate(OrganizationFixture());
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('0'));
  });

  it('reads an opt-out written by another hook instance', async () => {
    renderHook(useAuthV2Rollout);
    const {result: override} = renderHook(useEnableAuthV2);

    act(() => {
      OrganizationStore.onUpdate(OrganizationFixture({features: ['authv2-rollout']}));
    });
    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('1'));
    expect(getRolloutOrganization()).not.toBeNull();

    act(() => {
      override.current.setAuthV2CookieState(AuthV2CookieState.DISABLED);
      OrganizationStore.onUpdate(OrganizationFixture());
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('0'));
    expect(getRolloutOrganization()).toBeNull();
  });

  it('preserves rollout state in a different organization', async () => {
    Cookies.set('sentry_react_auth', '1', {path: '/'});
    setRolloutOrganization('rollout-org');
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onUpdate(OrganizationFixture({slug: 'other-org'}));
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBe('1'));
  });

  it('clears rollout state when disabled for the enrolling organization', async () => {
    Cookies.set('sentry_react_auth', '1', {path: '/'});
    setRolloutOrganization('rollout-org');
    renderHook(useAuthV2Rollout);

    act(() => {
      OrganizationStore.onUpdate(OrganizationFixture({slug: 'rollout-org'}));
    });

    await waitFor(() => expect(Cookies.get('sentry_react_auth')).toBeUndefined());
    expect(getRolloutOrganization()).toBeNull();
  });
});
