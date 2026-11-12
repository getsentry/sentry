import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';

import {getOpenPeriodIssueLocation} from './getOpenPeriodIssueLocation';

describe('getOpenPeriodIssueLocation', () => {
  it('links to the event that opened the open period', () => {
    const openPeriod = GroupOpenPeriodFixture({
      groupId: '42',
      activities: [
        GroupOpenPeriodActivityFixture({type: 'opened', eventId: 'opened-event'}),
        GroupOpenPeriodActivityFixture({
          type: 'status_change',
          eventId: 'status-change-event',
        }),
      ],
    });

    expect(getOpenPeriodIssueLocation(openPeriod, 'org-slug')).toEqual({
      pathname: '/organizations/org-slug/issues/42/',
      query: {eventId: 'opened-event'},
    });
  });

  it('links to the issue when the opening event is unknown', () => {
    const openPeriod = GroupOpenPeriodFixture({
      groupId: '42',
      activities: [GroupOpenPeriodActivityFixture({type: 'opened', eventId: null})],
    });

    expect(getOpenPeriodIssueLocation(openPeriod, 'org-slug')).toEqual({
      pathname: '/organizations/org-slug/issues/42/',
      query: {},
    });
  });

  it('carries the query over', () => {
    const openPeriod = GroupOpenPeriodFixture({
      groupId: '42',
      activities: [
        GroupOpenPeriodActivityFixture({type: 'opened', eventId: 'opened-event'}),
      ],
    });

    expect(
      getOpenPeriodIssueLocation(openPeriod, 'org-slug', {statsPeriod: '7d'}).query
    ).toEqual({statsPeriod: '7d', eventId: 'opened-event'});
  });
});
