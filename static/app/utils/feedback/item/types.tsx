import type {BaseGroup, GroupStats} from 'sentry/types';

type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export interface FeedbackItemLoaderQueryParams {
  [key: string]: string | string[] | undefined;
  feedbackSlug?: string;
}

export type RawFeedbackItemResponse = Overwrite<
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
>;

export type HydratedFeedbackItem = Overwrite<
  RawFeedbackItemResponse,
  {
    feedback_id: string;
    timestamp: Date;
  }
>;
