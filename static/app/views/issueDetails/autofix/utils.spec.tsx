import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeSeerLocation, makeSeerQuery} from 'sentry/views/issueDetails/autofix/utils';

describe('makeSeerLocation', () => {
  const withPage = OrganizationFixture({features: ['autofix-page']});
  const withoutPage = OrganizationFixture({features: []});

  it('points at the issue details drawer without the feature', () => {
    expect(makeSeerLocation({organization: withoutPage, groupId: '101'})).toEqual({
      pathname: '/organizations/org-slug/issues/101/',
      query: {seerDrawer: 'true'},
    });
  });

  it('points at the standalone page with the feature', () => {
    expect(makeSeerLocation({organization: withPage, groupId: '101'})).toEqual({
      pathname: '/organizations/org-slug/issues/101/autofix/',
      query: {},
    });
  });

  it('carries an action through to either destination', () => {
    expect(
      makeSeerLocation({
        organization: withoutPage,
        groupId: '101',
        action: 'retry_code_changes',
      }).query
    ).toEqual({seerDrawer: 'true', seerDrawerAction: 'retry_code_changes'});

    expect(
      makeSeerLocation({
        organization: withPage,
        groupId: '101',
        action: 'retry_code_changes',
      }).query
    ).toEqual({seerDrawerAction: 'retry_code_changes'});
  });

  it('preserves caller query params alongside the seer params', () => {
    expect(
      makeSeerLocation({
        organization: withoutPage,
        groupId: '101',
        query: {project: '1', referrer: 'inbox'},
      }).query
    ).toEqual({project: '1', referrer: 'inbox', seerDrawer: 'true'});
  });

  it('keeps page filters when forwarding a legacy drawer url to the tab', () => {
    expect(
      makeSeerLocation({
        organization: withPage,
        groupId: '101',
        query: {
          project: '1',
          environment: 'prod',
          statsPeriod: '7d',
          seerDrawer: 'true',
        },
      })
    ).toEqual({
      pathname: '/organizations/org-slug/issues/101/autofix/',
      query: {project: '1', environment: 'prod', statsPeriod: '7d'},
    });
  });

  it('lets the action argument win over a stale one in the caller query', () => {
    expect(
      makeSeerLocation({
        organization: withPage,
        groupId: '101',
        action: 'retry_code_changes',
        query: {seerDrawerAction: 'something_else'},
      }).query
    ).toEqual({seerDrawerAction: 'retry_code_changes'});
  });
});

describe('makeSeerQuery', () => {
  const withPage = OrganizationFixture({features: ['autofix-page']});

  it('omits the action param when no action is given', () => {
    expect(makeSeerQuery(withPage)).not.toHaveProperty('seerDrawerAction');
  });
});
