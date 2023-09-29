type Overwrite<T, U> = Pick<T, Exclude<keyof T, keyof U>> & U;

export interface FeedbackItemResponse {
  browser: {
    name: null | string;
    version: null | string;
  };
  contact_email: string;
  device: {
    brand: null | string;
    family: null | string;
    model: null | string;
    name: null | string;
  };
  dist: string;
  environment: string;
  feedback_id: string;
  locale: {
    lang: string;
    timezone: string;
  };
  message: string;
  os: {
    name: null | string;
    version: null | string;
  };
  platform: string;
  project_id: number;
  release: string;
  replay_id: null | string;
  sdk: {
    name: string;
    version: string;
  };
  status: 'unresolved' | 'resolved';
  tags: Record<string, string>;
  timestamp: string;
  url: string;
  user: {
    display_name: null | string;
    email: null | string;
    id: null | string;
    ip: null | string;
    username: null | string;
  };
}

export type FeedbackListResponse = FeedbackItemResponse[];

export type HydratedFeedbackItem = Overwrite<FeedbackItemResponse, {timestamp: Date}>;

export type HydratedFeedbackList = HydratedFeedbackItem[];

export interface FeedbackListQueryParams {
  [key: string]: string | string[] | null | undefined;
  cursor?: string;
  end?: string;
  environment?: string[];
  field?: string[];
  offset?: string;
  per_page?: string;
  project?: string[];
  query?: string;
  queryReferrer?: string;
  sort?: string | 'timestamp' | '-timestamp' | 'projectId' | '-projectId';
  start?: string;
  statsPeriod?: string;
  utc?: 'true' | 'false';
}

export interface FeedbackItemLoaderQueryParams {
  [key: string]: string | string[] | null | undefined;
  feedbackSlug?: string;
}
