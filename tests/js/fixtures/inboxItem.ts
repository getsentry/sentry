import type {InboxItem} from 'sentry/views/inbox/types';

export function InboxItemFixture(params: Partial<InboxItem> = {}): InboxItem {
  return {
    id: '1',
    subjectType: 'issue',
    subjectId: '1',
    title: 'TypeError: Cannot read properties of undefined',
    subtitle: 'Assigned to you',
    eventTypes: ['issue.user_assigned'],
    eventCount: 1,
    unreadEventCount: 1,
    latestEvent: {
      id: '1',
      type: 'issue.user_assigned',
      actor: {type: 'user', id: '1', name: 'Foo Bar', avatar: null},
      data: {assignmentSource: null},
      summary: 'Assigned to you',
      isUnread: true,
      dateAdded: '2020-01-01T00:00:00.000Z',
    },
    isUnread: true,
    lastActivityAt: '2020-01-01T00:00:00.000Z',
    lastReadAt: null,
    ...params,
  };
}
