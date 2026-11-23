/**
 * Client key (DSN) endpoints for a project. Each wrapper validates the
 * response with the schema the host passes, so the host's schema decides the
 * result type.
 */

import {
  apiPath,
  type ApiTarget,
  type ResponseSchema,
  validateResponse,
} from "@sentry/api/client";

export type ClientKeyProjectParams = {
  organizationSlug: string;
  projectSlug: string;
};

/** Every client key of a project. */
export async function listClientKeys<T>(
  { core, origin }: ApiTarget,
  { organizationSlug, projectSlug }: ClientKeyProjectParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/keys/`,
  );
  return validateResponse(schema, body);
}

/** Create a client key, optionally named. */
export async function createClientKey<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    name,
  }: ClientKeyProjectParams & { name?: string },
  schema: ResponseSchema<T>,
): Promise<T> {
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/keys/`,
    { method: "POST", body: JSON.stringify({ name }) },
  );
  return validateResponse(schema, body);
}

export type ClientKeyUpdate = {
  name?: string;
  isActive?: boolean;
  /** Caps accepted errors per window; `null` removes the limit. */
  rateLimit?: { window: number; count: number } | null;
  browserSdkVersion?: string;
  dynamicSdkLoaderOptions?: {
    hasReplay?: boolean;
    hasPerformance?: boolean;
    hasDebug?: boolean;
    hasFeedback?: boolean;
    hasLogsAndMetrics?: boolean;
  };
};

export type UpdateClientKeyParams = ClientKeyProjectParams & {
  keyId: string | number;
} & ClientKeyUpdate;

/** Update a client key. Only the fields that are set are sent. */
export async function updateClientKey<T>(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    projectSlug,
    keyId,
    name,
    isActive,
    rateLimit,
    browserSdkVersion,
    dynamicSdkLoaderOptions,
  }: UpdateClientKeyParams,
  schema: ResponseSchema<T>,
): Promise<T> {
  const data: ClientKeyUpdate = {};
  if (name !== undefined) {
    data.name = name;
  }
  if (isActive !== undefined) {
    data.isActive = isActive;
  }
  if (rateLimit !== undefined) {
    data.rateLimit = rateLimit;
  }
  if (browserSdkVersion !== undefined) {
    data.browserSdkVersion = browserSdkVersion;
  }
  if (dynamicSdkLoaderOptions !== undefined) {
    data.dynamicSdkLoaderOptions = dynamicSdkLoaderOptions;
  }
  const body = await core.requestJson(
    origin,
    apiPath`/projects/${organizationSlug}/${projectSlug}/keys/${keyId}/`,
    { method: "PUT", body: JSON.stringify(data) },
  );
  return validateResponse(schema, body);
}
