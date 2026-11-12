import {OrganizationFixture} from 'sentry-fixture/organization';

import {RequestError} from 'sentry/utils/requestError/requestError';

import {OrganizationStore} from './organizationStore';

describe('OrganizationStore', () => {
  beforeEach(() => {
    OrganizationStore.reset();
  });

  it('starts with loading state', () => {
    expect(OrganizationStore.getState()).toMatchObject({
      loading: true,
      error: null,
      errorType: null,
      organization: null,
    });
  });

  it('updates correctly', () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.getState()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });

    // updates
    organization.slug = 'a new slug';
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.getState()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });
  });

  it('updates correctly from setting changes', () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.getState()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
    });
  });

  it('errors correctly', () => {
    const error = new RequestError('GET', '/some/path', new Error('uh oh'));
    error.status = 404;
    OrganizationStore.onFetchOrgError(error);
    expect(OrganizationStore.getState()).toMatchObject({
      loading: false,
      error,
      errorType: 'ORG_NOT_FOUND',
      organization: null,
    });
  });

  it('merges partial updates unless replace is set', () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);

    OrganizationStore.onUpdate({name: 'Renamed'});
    expect(OrganizationStore.getState().organization).toEqual({
      ...organization,
      name: 'Renamed',
    });

    const replacement = OrganizationFixture({id: '2', slug: 'other'});
    OrganizationStore.onUpdate(replacement, {replace: true});
    expect(OrganizationStore.getState().organization).toEqual(replacement);
  });

  it('notifies subscribers on update', () => {
    const listener = jest.fn();
    const unsubscribe = OrganizationStore.subscribe(listener);

    OrganizationStore.onUpdate(OrganizationFixture());

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('returns a stable reference from getState', () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);
    const state = OrganizationStore.getState();
    expect(Object.is(state, OrganizationStore.getState())).toBe(true);
  });
});
