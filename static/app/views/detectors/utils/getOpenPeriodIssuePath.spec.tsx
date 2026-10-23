import {
  GroupOpenPeriodActivityFixture,
  GroupOpenPeriodFixture,
} from 'sentry-fixture/groupOpenPeriod';

import {ConfigStore} from 'sentry/stores/configStore';
import {getOpenPeriodIssuePath} from 'sentry/views/detectors/utils/getOpenPeriodIssuePath';

describe('getOpenPeriodIssuePath', () => {
  afterEach(() => {
    ConfigStore.set('customerDomain', null);
  });

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

    expect(getOpenPeriodIssuePath(openPeriod, 'org-slug')).toBe(
      '/organizations/org-slug/issues/42/events/opened-event/'
    );
  });

  it('links to the issue when the opening event is unknown', () => {
    const openPeriod = GroupOpenPeriodFixture({
      groupId: '42',
      activities: [GroupOpenPeriodActivityFixture({type: 'opened', eventId: null})],
    });

    expect(getOpenPeriodIssuePath(openPeriod, 'org-slug')).toBe(
      '/organizations/org-slug/issues/42/'
    );
  });

  it('drops the organization from the path on customer domains', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    const openPeriod = GroupOpenPeriodFixture({
      groupId: '42',
      activities: [
        GroupOpenPeriodActivityFixture({type: 'opened', eventId: 'opened-event'}),
      ],
    });

    expect(getOpenPeriodIssuePath(openPeriod, 'org-slug')).toBe(
      '/issues/42/events/opened-event/'
    );
  });
});
