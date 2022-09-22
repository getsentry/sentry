import {z} from 'zod';

import {logException} from 'sentry/utils/logging';

import {groupFirstLastReleaseSchema} from './schemas/groupFirstLastReleaseSchema';

export const endpoints = {
  '/issues/:groupId/first-last-release/': groupFirstLastReleaseSchema,
} as const;

type EndpointsMapping = typeof endpoints;
type Endpoint = keyof EndpointsMapping;

export type InferEndpointResponse<T extends Endpoint> = z.infer<typeof endpoints[T]>;

export const validateEndpointResponse = <T extends Endpoint>(
  endpoint: T,
  data: unknown
) => {
  const schema = endpoints[endpoint];

  try {
    schema.parse(data);
  } catch (e) {
    // For validation errors we don't want to blow up immediately.
    // Log the error so we can address at a later point.
    logException(e);
  }

  return data as z.infer<typeof schema>;
};
