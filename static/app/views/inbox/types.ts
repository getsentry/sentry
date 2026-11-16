import type {Avatar} from 'sentry/types/core';

export const INBOX_SUBJECT_TYPES = ['issue', 'notebook'] as const;

export type InboxSubjectType = (typeof INBOX_SUBJECT_TYPES)[number];

export const INBOX_RECIPIENTS = ['team', 'user'] as const;

export type InboxRecipient = (typeof INBOX_RECIPIENTS)[number];

export const INBOX_EVENT_TYPES = [
  'issue.user_assigned',
  'issue.team_assigned',
  'issue.user_mentioned',
  'issue.team_mentioned',
  'issue.pr_ready_for_review',
  'notebook.completed',
  'notebook.user_mentioned',
  'notebook.team_mentioned',
  'notebook.participant_added',
] as const;

export type InboxEventType = (typeof INBOX_EVENT_TYPES)[number];

interface InboxIssueAssignedData {
  assignmentSource:
    | 'codeowners'
    | 'projectOwnership'
    | 'slack'
    | 'msteams'
    | 'discord'
    | 'suspectCommitter'
    | 'seerSuggested'
    | null;
}

interface InboxEventDataByType {
  'issue.pr_ready_for_review': {prUrl: string; seerRunId: string};
  'issue.team_assigned': InboxIssueAssignedData;
  'issue.team_mentioned': {commentId: string};
  'issue.user_assigned': InboxIssueAssignedData;
  'issue.user_mentioned': {commentId: string};
  'notebook.completed': {seerRunId: string};
  'notebook.participant_added': Record<string, never>;
  'notebook.team_mentioned': {blockId: string | null; commentId: string};
  'notebook.user_mentioned': {blockId: string | null; commentId: string};
}

type InboxSystemActor = {
  avatar: null;
  id: null;
  name: 'Sentry';
  type: 'system';
};

type InboxUserActor = {
  avatar: Avatar | null;
  id: string;
  name: string;
  type: 'user';
};

type InboxActor = InboxSystemActor | InboxUserActor;

interface BaseInboxItemEvent {
  actor: InboxActor;
  dateAdded: string;
  id: string;
  isUnread: boolean;
  summary: string;
}

type InboxItemEvent = {
  [T in InboxEventType]: BaseInboxItemEvent & {
    data: InboxEventDataByType[T];
    type: T;
  };
}[InboxEventType];

export interface InboxItem {
  eventCount: number;
  eventTypes: InboxEventType[];
  id: string;
  isUnread: boolean;
  lastActivityAt: string;
  lastReadAt: string | null;
  latestEvent: InboxItemEvent;
  subjectId: string;
  subjectType: InboxSubjectType;
  subtitle: string;
  title: string | null;
  unreadEventCount: number;
}

export type InboxSubject = Pick<InboxItem, 'subjectId' | 'subjectType'>;

export interface InboxFilters {
  eventType: InboxEventType[];
  recipient: InboxRecipient[];
  subjectType: InboxSubjectType[];
}
