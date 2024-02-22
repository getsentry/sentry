import {OrganizationFixture} from 'sentry-fixture/organization';

import {getTabs} from './utils';

describe('getTabs', () => {
  it('displays the correct list of tabs', () => {
    expect(getTabs(OrganizationFixture({})).filter(tab => !tab[1].hidden)).toEqual([
      ['is:unresolved', expect.objectContaining({name: 'Unresolved'})],
      [
        'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
        expect.objectContaining({name: 'For Review'}),
      ],
      ['is:regressed', expect.objectContaining({name: 'Regressed'})],
      ['is:escalating', expect.objectContaining({name: 'Escalating'})],
      ['is:archived', expect.objectContaining({name: 'Archived'})],
    ]);
  });

  it('should add inbox tab for issue-priority-ui feature', () => {
    expect(getTabs(OrganizationFixture({features: ['issue-priority-ui']}))[0]).toEqual([
      'is:unresolved issue.priority:[high, medium]',
      expect.objectContaining({name: 'Inbox'}),
    ]);
  });
});
