import {Organization} from 'sentry-fixture/organization';

import {getTabs} from './utils';

describe('getTabs', () => {
  it('should enable/disable tabs for escalating-issues', () => {
    expect(
      getTabs(Organization({features: ['escalating-issues']})).map(tab => tab[1].name)
    ).toEqual([
      'Unresolved',
      'For Review',
      'Regressed',
      'Escalating',
      'Archived',
      'Custom',
    ]);

    expect(getTabs(Organization({features: []})).map(tab => tab[1].name)).toEqual([
      'All Unresolved',
      'For Review',
      'Ignored',
      'Custom',
    ]);
  });

  it('should enable/disable my_teams filter in For Review tab', () => {
    expect(getTabs(Organization({features: []})).map(tab => tab[0])).toEqual([
      'is:unresolved',
      'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
      'is:ignored',
      '__custom__',
    ]);
  });
});
