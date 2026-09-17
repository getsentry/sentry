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

  it('omits the action param when no action is given', () => {
    expect(makeSeerQuery(withPage)).not.toHaveProperty('seerDrawerAction');
  });
});
