import type {Avatar} from 'sentry/types/core';

export type InboxSubjectType = 'issue' | 'notebook';

interface InboxEventDataByType {
  'issue.assigned': {
    assignmentSource: string | null;
  };
  'issue.pr_ready_for_review': {prUrl: string; seerRunId: string};
  'issue.team_mentioned': {commentId: string};
  'issue.user_mentioned': {commentId: string};
  'notebook.completed': {seerRunId: string};
  'notebook.mentioned': {commentId: string};
  'notebook.needs_attention': Record<string, unknown>;
  'notebook.participant_added': Record<string, never>;
}

type InboxEventType = keyof InboxEventDataByType;

type InboxSystemActor = {
  avatar: null;
  id: null;
  name: string;
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
