import type SentrySDK from '@sentry/react'; // TODO: change to `@sentry/browser` when we have our own package.json

import type {Organization} from 'sentry/types/organization';

export type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';

export type Configuration = {
  apiPrefix: string;
  environment: string | string[];
  organization: Organization | undefined;
  organizationSlug: string;
  placement: 'right-edge' | 'bottom-right-corner';
  projectId: number;
  projectSlug: string;
  SentrySDK?: typeof SentrySDK;
  domId?: string;
  trackAnalytics?: (props: {eventKey: string; eventName: string}) => void;
};

type APIRequestMethod = 'POST' | 'GET' | 'DELETE' | 'PUT';

type QueryKeyEndpointOptions<
  Headers = Record<string, string>,
  Query = Record<string, any>,
  Payload = Record<string, any>,
> = {
  headers?: Headers;
  method?: APIRequestMethod;
  payload?: Payload;
  query?: Query;
};

export type ApiQueryKey =
  | readonly [url: string]
  | readonly [
      url: string,
      options: QueryKeyEndpointOptions<
        Record<string, string>,
        Record<string, any>,
        Record<string, any>
      >,
    ];

export type ApiResult<Data = unknown> = {
  headers: Headers;
  json: Data;
};
