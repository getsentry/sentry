import type SentrySDK from '@sentry/react'; // TODO: change to `@sentry/browser` when we have our own package.json

export type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';

export type FlagValue = boolean | string | number | undefined;
export type FeatureFlagMap = Record<string, {override: FlagValue; value: FlagValue}>;

export type Configuration = {
  apiPrefix: string;
  environment: string | string[];
  organizationSlug: string;
  placement: 'right-edge' | 'bottom-right-corner';
  projectId: number;
  projectPlatform: string;
  projectSlug: string;
  SentrySDK?: typeof SentrySDK;
  domId?: string;
  featureFlags?: {
    clearOverrides?: () => void;
    getFeatureFlagMap?: () => FeatureFlagMap;
    setOverrideValue?: (name: string, override: FlagValue) => void;
    urlTemplate?: (name: string) => string | undefined;
  };

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

// Prefix the key with a namespace, to avoid key collisions with other tanstack/query
// cache requests that imported sentry modules make within the toolbar scope.
export type ApiEndpointQueryKey =
  | readonly ['io.sentry.toolbar', url: string]
  | readonly [
      'io.sentry.toolbar',
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
