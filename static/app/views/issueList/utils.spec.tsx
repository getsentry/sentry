import {OrganizationFixture} from 'sentry-fixture/organization';

import {getTabs} from './utils';

describe('getTabs', () => {
  it('should enable/disable tabs for escalating-issues', () => {
    expect(
      getTabs(OrganizationFixture({}))
        .filter(tab => !tab[1].hidden)
        .map(tab => tab[1].name)
    ).toEqual(['Unresolved', 'For Review', 'Regressed', 'Escalating', 'Archived']);
  });

  it('should enable/disable my_teams filter in For Review tab', () => {
    expect(
      getTabs(OrganizationFixture({}))
        .filter(tab => !tab[1].hidden)
        .map(tab => tab[0])
    ).toEqual([
      'is:unresolved',
      'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
      'is:regressed',
      'is:escalating',
      'is:archived',
    ]);
  });

  it('should add inbox tab for issue-priority-ui feature', () => {
    expect(getTabs(OrganizationFixture({features: ['issue-priority-ui']}))[0]).toEqual([
      'is:unresolved issue.priority:[high, medium]',
      expect.objectContaining({hidden: false, name: 'Inbox'}),
    ]);
  });
});
