import {
  FeedbackItemResponse,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/item/types';

export type FeedbackListResponse = FeedbackItemResponse[];

export type HydratedFeedbackList = HydratedFeedbackItem[];

export type QueryView = {
  // maxTimestamp: number;
  queryReferrer: string;
  end?: string;
  environment?: string[];
  field?: string[];
  per_page?: string;
  project?: string[];
  query?: string;
  sort?: string;
  start?: string;
  statsPeriod?: string;
  utc?: string;
};

export const EMPTY_QUERY_VIEW: QueryView = {
  // maxTimestamp: 0,
  queryReferrer: '',
};
