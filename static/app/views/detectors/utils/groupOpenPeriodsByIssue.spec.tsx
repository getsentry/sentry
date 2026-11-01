import {GroupOpenPeriodFixture} from 'sentry-fixture/groupOpenPeriod';

import {groupOpenPeriodsByIssue} from 'sentry/views/detectors/utils/groupOpenPeriodsByIssue';

describe('groupOpenPeriodsByIssue', () => {
  it('orders issues by their newest open period', () => {
    const openPeriods = [
      GroupOpenPeriodFixture({id: '3', groupId: '200'}),
      GroupOpenPeriodFixture({id: '2', groupId: '100'}),
      GroupOpenPeriodFixture({id: '1', groupId: '100'}),
    ];

    const issues = groupOpenPeriodsByIssue(openPeriods);

    expect(issues.map(issue => issue.groupId)).toEqual(['200', '100']);
  });

  it('keeps each issue with its short id and its open periods newest first', () => {
    const openPeriods = [
      GroupOpenPeriodFixture({id: '3', groupId: '100', shortId: 'PROJ-1'}),
      GroupOpenPeriodFixture({id: '2', groupId: '200', shortId: 'PROJ-2'}),
      GroupOpenPeriodFixture({id: '1', groupId: '100', shortId: 'PROJ-1'}),
    ];

    const [firstIssue] = groupOpenPeriodsByIssue(openPeriods);

    expect(firstIssue?.shortId).toBe('PROJ-1');

    expect(firstIssue?.openPeriods.map(openPeriod => openPeriod.id)).toEqual(['3', '1']);
  });

  it('returns no issues when there are no open periods', () => {
    expect(groupOpenPeriodsByIssue([])).toEqual([]);
  });
});
