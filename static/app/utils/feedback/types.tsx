import type {BaseGroup, Event, GroupStats, IssueCategory, IssueType} from 'sentry/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type FeedbackIssue = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: IssueCategory.FEEDBACK;
    issueType: IssueType.FEEDBACK;
    metadata: {
      contact_email: null | string;
      message: string;
      name: string;
      title: string;
      value: string;
      source?: null | string;
    };
    owners: null | unknown;
  }
>;

export type FeedbackEvent = Event;

export type FeedbackIssueList = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: 'feedback';
    issueType: 'feedback';
    metadata: {
      contact_email: null | string;
      message: string;
      name: string;
      title: string;
      value: string;
    };
    owners: null | unknown;
  }
>[];
