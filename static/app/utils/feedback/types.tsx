import type {Event} from 'sentry/types/event';
import type {BaseGroup, GroupStats} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type FeedbackIssueMetadata = {
  contact_email: null | string;
  message: string;
  name: null | string;
  title: string;
  value: string;
  sdk?: {
    name: string;
    name_normalized: string;
  };
  source?: null | string;
  summary?: null | string;
};

export type FeedbackIssue = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: 'feedback';
    issueType: 'feedback';
    metadata: FeedbackIssueMetadata & {initial_priority?: number};
    owners: null | unknown;
    project?: Project;
  }
>;

export type FeedbackEvent = Event;

export type FeedbackIssueListItem = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: 'feedback';
    issueType: 'feedback';
    metadata: FeedbackIssueMetadata & {associated_event_id?: string};
    owners: null | unknown;
    project?: Project;
  }
>;
