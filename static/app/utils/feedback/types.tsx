import type {BaseGroup, Event, GroupStats, IssueCategory} from 'sentry/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type FeedbackIssue = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: IssueCategory.FEEDBACK;
    issueType: 'feedback';
    metadata: {
      contact_email: null | string;
      message: string;
      name: string;
      title: string;
      value: string;
      sdk?: {
        name: string;
        name_normalized: string;
      };
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
      sdk?: {
        name: string;
        name_normalized: string;
      };
      source?: null | string;
    };
    owners: null | unknown;
  }
>[];
