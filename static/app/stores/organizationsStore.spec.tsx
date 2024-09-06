import {OrganizationFixture} from 'sentry-fixture/organization';

import OrganizationsStore from 'sentry/stores/organizationsStore';

describe('OrganizationsStore', () => {
  beforeEach(() => {
    OrganizationsStore.init();
  });

  it('starts with loading state', () => {
    expect(OrganizationsStore.getState()).toEqual({
      organizations: [],
      loaded: false,
    });
  });

  it('updates slug correctly', () => {
    const organization = OrganizationFixture();
    OrganizationsStore.load([organization]);
    expect(OrganizationsStore.getState()).toEqual({
      organizations: [organization],
      loaded: true,
    });

    const update = {...organization, slug: 'california'};
    OrganizationsStore.onChangeSlug(organization, update);
    expect(OrganizationsStore.getState()).toMatchObject({
      organizations: [update],
      loaded: true,
    });
  });

  it('updates property correctly', () => {
    const organization = OrganizationFixture();
    OrganizationsStore.load([organization]);
    expect(OrganizationsStore.getState()).toEqual({
      organizations: [organization],
      loaded: true,
    });

    const update = {...organization, something: true};
    OrganizationsStore.onUpdate(update);
    expect(OrganizationsStore.getState()).toMatchObject({
      organizations: [update],
      loaded: true,
    });
  });

  it('adds an organization', () => {
    const organization = OrganizationFixture();
    OrganizationsStore.load([organization]);

    const newOrg = OrganizationFixture({id: '2', slug: 'new'});
    OrganizationsStore.addOrReplace(newOrg);
    expect(OrganizationsStore.getState()).toMatchObject({
      organizations: [organization, newOrg],
      loaded: true,
    });
  });

  it('returns a stable reference with getState', () => {
    const state = OrganizationsStore.getState();
    expect(Object.is(state, OrganizationsStore.getState())).toBe(true);
  });
});
