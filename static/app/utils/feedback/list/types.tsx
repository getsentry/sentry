import type {BaseGroup, GroupStats} from 'sentry/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export type RawFeedbackListResponse = Overwrite<
  BaseGroup & GroupStats,
  {
    issueCategory: 'feedback';
    issueType: 'feedback';
    metadata: {
      contact_email: null | string;
      message: string;
      title: string;
      value: string;
    };
    owners: null | unknown;
  }
>[];

export type HydratedFeedbackList = Overwrite<
  RawFeedbackListResponse,
  {feedback_id: string; replay_id: undefined; timestamp: Date}
>[];
