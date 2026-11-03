import type {Avatar} from 'sentry/types/core';

export type InboxSubjectType = 'issue' | 'notebook';

interface InboxEventDataByType {
  'issue.assigned': {
    /**
     * What caused the assignment, such as an ownership rule, a Seer suggestion or a user.
     */
    source: string;
  };
  'issue.mentioned': {commentId: string};
  'issue.pr_ready_for_review': {prUrl: string; seerRunId: string};
  'notebook.completed': {seerRunId: string};
  'notebook.mentioned': {commentId: string};
  // TODO: Shape is still to be decided in the tech spec
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

export type InboxActor = InboxSystemActor | InboxUserActor;

interface InboxSubjectSummary {
  title: string;
}

interface BaseInboxItemEvent {
  actor: InboxActor;
  dateAdded: string;
  id: string;
  preview: string | null;
  title: string;
}

type InboxItemEvent = {
  [T in InboxEventType]: BaseInboxItemEvent & {
    data: InboxEventDataByType[T];
    type: T;
  };
}[InboxEventType];

export interface InboxItem {
  id: string;
  isUnread: boolean;
  lastActivityAt: string;
  lastReadAt: string | null;
  latestEvent: InboxItemEvent;
  subject: InboxSubjectSummary | null;
  subjectId: string;
  subjectType: InboxSubjectType;
  unreadEventCount: number;
}
