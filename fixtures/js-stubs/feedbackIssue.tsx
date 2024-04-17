import {ProjectFixture} from 'sentry-fixture/project';

import {EventOrGroupType} from 'sentry/types/event';
import {GroupStatus, PriorityLevel} from 'sentry/types/group';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;
type PartialMetadata = Partial<FeedbackIssue['metadata']>;

export function FeedbackIssueFixture(
  params: Partial<Overwrite<FeedbackIssue, {metadata: PartialMetadata}>>
): FeedbackIssue {
  return {
    id: '5146636313',
    shareId: '',
    shortId: 'JAVASCRIPT-2SDJ',
    title: 'User Feedback',
    culprit: 'user',
    permalink:
      'https://sentry.sentry.io/feedback/?feedbackSlug=javascript%3A5146636313&project=11276',
    logger: null,
    level: 'info',
    status: GroupStatus.UNRESOLVED,
    statusDetails: {},
    substatus: null,
    isPublic: false,
    platform: 'javascript',
    project: ProjectFixture({
      platform: 'javascript',
    }),
    type: EventOrGroupType.GENERIC,
    filtered: null,
    numComments: 0,
    assignedTo: null,
    isBookmarked: false,
    isSubscribed: false,
    subscriptionDetails: {
      disabled: true,
    },
    hasSeen: true,
    annotations: [],
    issueType: 'feedback',
    issueCategory: 'feedback',
    priority: PriorityLevel.MEDIUM,
    priorityLockedAt: null,
    isUnhandled: false,
    count: '1',
    userCount: 1,
    firstSeen: '2024-04-05T20:05:02.938000Z',
    lastSeen: '2024-04-05T20:05:02Z',
    inbox: null,
    owners: null,
    activity: [],
    seenBy: [],
    pluginActions: [],
    pluginIssues: [],
    pluginContexts: [],
    userReportCount: 0,
    stats: {},
    participants: [],
    ...params,
    metadata: {
      title: 'User Feedback',
      value: 'feedback test 4',
      initial_priority: 50,
      contact_email: 'josh.ferge@sentry.io',
      message: 'feedback test 4',
      name: 'Josh Ferge',
      source: 'new_feedback_envelope',
      sdk: {
        name: 'sentry.javascript.react',
        name_normalized: 'sentry.javascript.react',
      },
      ...params.metadata,
    },
  };
}
