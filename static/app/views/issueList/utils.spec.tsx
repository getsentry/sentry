import {getTabs} from './utils';

describe('getTabs', () => {
  it('displays the correct list of tabs', () => {
    expect(getTabs().filter(tab => !tab[1].hidden)).toEqual([
      [
        'is:unresolved issue.priority:[high, medium]',
        expect.objectContaining({name: 'Prioritized'}),
      ],
      [
        'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
        expect.objectContaining({name: 'For Review'}),
      ],
      ['is:regressed', expect.objectContaining({name: 'Regressed'})],
      ['is:escalating', expect.objectContaining({name: 'Escalating'})],
      ['is:archived', expect.objectContaining({name: 'Archived'})],
      ['is:reprocessing', expect.objectContaining({name: 'Reprocessing'})],
    ]);
  });
});
