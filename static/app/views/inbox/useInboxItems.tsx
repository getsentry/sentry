import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import type {InboxActor, InboxItem} from 'sentry/views/inbox/types';

const SYSTEM_ACTOR: InboxActor = {type: 'system', id: null, name: 'Sentry', avatar: null};

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function makeMockInboxItems(): InboxItem[] {
  const jane: InboxActor = {type: 'user', id: '2', name: 'Jane Doe', avatar: null};
  const sam: InboxActor = {type: 'user', id: '3', name: 'Sam Lee', avatar: null};

  return [
    {
      id: '1',
      subjectType: 'issue',
      subjectId: '101',
      subject: {title: "TypeError: Cannot read properties of undefined (reading 'id')"},
      unreadEventCount: 2,
      latestEvent: {
        id: '1001',
        type: 'issue.mentioned',
        actor: jane,
        data: {commentId: '555'},
        title: 'Jane Doe mentioned you in a comment',
        preview: 'Can you take a look? This started right after the last deploy.',
        dateAdded: minutesAgo(5),
      },
      isUnread: true,
      lastActivityAt: minutesAgo(5),
      lastReadAt: null,
    },
    {
      id: '2',
      subjectType: 'notebook',
      subjectId: '203',
      subject: {title: 'OperationalError: could not connect to server'},
      unreadEventCount: 1,
      latestEvent: {
        id: '1002',
        type: 'notebook.needs_attention',
        actor: SYSTEM_ACTOR,
        data: {blockId: '7'},
        title: 'Seer needs your input to continue this investigation',
        preview: 'Which database host should I check connection limits on?',
        dateAdded: minutesAgo(45),
      },
      isUnread: true,
      lastActivityAt: minutesAgo(45),
      lastReadAt: null,
    },
    {
      id: '3',
      subjectType: 'notebook',
      subjectId: '201',
      subject: {title: 'Checkout latency regression'},
      unreadEventCount: 0,
      latestEvent: {
        id: '1003',
        type: 'notebook.completed',
        actor: SYSTEM_ACTOR,
        data: {seerRunId: '301'},
        title: 'Seer finished this investigation',
        preview:
          'Latency increased after a new database index was dropped in the latest migration.',
        dateAdded: minutesAgo(180),
      },
      isUnread: false,
      lastActivityAt: minutesAgo(180),
      lastReadAt: minutesAgo(120),
    },
    {
      id: '4',
      subjectType: 'issue',
      subjectId: '103',
      subject: {title: 'ChunkLoadError: Loading chunk 42 failed'},
      unreadEventCount: 0,
      latestEvent: {
        id: '1004',
        type: 'issue.assigned',
        actor: sam,
        data: {source: 'user'},
        title: 'Sam Lee assigned you to this issue',
        preview: null,
        dateAdded: minutesAgo(60 * 26),
      },
      isUnread: false,
      lastActivityAt: minutesAgo(60 * 26),
      lastReadAt: minutesAgo(60 * 25),
    },
    {
      id: '5',
      subjectType: 'notebook',
      subjectId: '202',
      subject: {title: 'Payment retries failing in EU'},
      unreadEventCount: 0,
      latestEvent: {
        id: '1005',
        type: 'notebook.mentioned',
        actor: sam,
        data: {commentId: '556'},
        title: 'Sam Lee mentioned you in this notebook',
        preview: 'Does this line up with what you saw in the retry queue last week?',
        dateAdded: minutesAgo(60 * 72),
      },
      isUnread: false,
      lastActivityAt: minutesAgo(60 * 72),
      lastReadAt: minutesAgo(60 * 70),
    },
  ];
}

/**
 * Placeholder until `GET /organizations/{org}/inbox/` exists. Replace the
 * query with `apiOptions` once the endpoint is available.
 */
export function useInboxItems() {
  const organization = useOrganization();

  return useQuery({
    queryKey: ['inbox-items-placeholder', organization.slug],
    queryFn: () => Promise.resolve(makeMockInboxItems()),
    staleTime: Infinity,
  });
}
