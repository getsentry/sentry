import type {BaseGroup, Event, GroupStats} from 'sentry/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type FeedbackIssue = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: 'feedback';
    issueType: 'feedback';
    metadata: {
      contact_email: null | string;
      crash_report_event_id: null | string;
      message: string;
      name: null | string;
      title: string;
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
      crash_report_event_id: null | string;
      message: string;
      name: null | string;
      title: string;
    };
    owners: null | unknown;
  }
>[];
