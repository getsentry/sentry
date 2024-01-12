import {OrganizationFixture} from 'sentry-fixture/organization';

import {getTabs} from './utils';

describe('getTabs', () => {
  it('should enable/disable tabs for escalating-issues', () => {
    expect(getTabs(OrganizationFixture({})).map(tab => tab[1].name)).toEqual([
      'Unresolved',
      'For Review',
      'Regressed',
      'Escalating',
      'Archived',
      'Custom',
    ]);

    expect(getTabs(OrganizationFixture({})).map(tab => tab[1].name)).toEqual([
      'Unresolved',
      'For Review',
      'Regressed',
      'Escalating',
      'Archived',
      'Custom',
    ]);
  });

  it('should enable/disable my_teams filter in For Review tab', () => {
    expect(getTabs(OrganizationFixture({features: []})).map(tab => tab[0])).toEqual([
      'is:unresolved',
      'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
      'is:regressed',
      'is:escalating',
      'is:archived',
      '__custom__',
    ]);
  });
});
