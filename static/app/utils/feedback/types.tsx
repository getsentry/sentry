import type {Event} from 'sentry/types/event';
import type {BaseGroup, GroupStats} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

type FeedbackIssueMetadata = {
  contact_email: null | string;
  message: string;
  name: string;
  title: string;
  value: string;
  associated_event_id?: string;
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
    metadata: FeedbackIssueMetadata;
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
    metadata: FeedbackIssueMetadata;
    owners: null | unknown;
    project?: Project;
  }
>;
