import {getTabs} from './utils';

describe('getTabs', () => {
  it('should enable/disable tabs for escalating-issues', () => {
    expect(
      getTabs(TestStubs.Organization({features: ['escalating-issues']})).map(
        tab => tab[1].name
      )
    ).toEqual(['Unresolved', 'For Review', 'New', 'Escalating', 'Ongoing', 'Archived']);

    expect(
      getTabs(TestStubs.Organization({features: []})).map(tab => tab[1].name)
    ).toEqual(['All Unresolved', 'For Review', 'Ignored']);
  });
});
