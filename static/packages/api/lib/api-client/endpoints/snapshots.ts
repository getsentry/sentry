/**
 * Preprod snapshot endpoints. The responses are returned unvalidated: the
 * callers read them as unknown JSON.
 */

import { apiPath, type ApiTarget, withQuery } from "@sentry/api/client";

/** One snapshot, with compact image metadata unless `compactMetadata` is false. */
export async function getSnapshot(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    snapshotId,
    compactMetadata = true,
  }: {
    organizationSlug: string;
    snapshotId: string;
    compactMetadata?: boolean;
  },
): Promise<unknown> {
  const query = new URLSearchParams();
  if (compactMetadata) {
    query.set("compact_metadata", "true");
  }
  return await core.requestJson(
    origin,
    withQuery(
      apiPath`/organizations/${organizationSlug}/preprodartifacts/snapshots/${snapshotId}/`,
      query,
    ),
  );
}

/** One image of a snapshot. */
export async function getSnapshotImage(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    snapshotId,
    imageIdentifier,
  }: {
    organizationSlug: string;
    snapshotId: string;
    imageIdentifier: string;
  },
): Promise<unknown> {
  return await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/preprodartifacts/snapshots/${snapshotId}/images/${imageIdentifier}/`,
  );
}

export type GetLatestBaseSnapshotParams = {
  organizationSlug: string;
  appId: string;
  branch?: string;
  /** Numeric project ID. */
  project?: string;
  projectSlug?: string;
  /** Default: true. */
  compactMetadata?: boolean;
};

/** The latest base snapshot of an app, optionally on one branch. */
export async function getLatestBaseSnapshot(
  { core, origin }: ApiTarget,
  {
    organizationSlug,
    appId,
    branch,
    project,
    projectSlug,
    compactMetadata = true,
  }: GetLatestBaseSnapshotParams,
): Promise<unknown> {
  const query = new URLSearchParams();
  query.set("app_id", appId);
  if (branch) query.set("branch", branch);
  if (project) query.set("project", project);
  if (projectSlug) query.set("projectSlug", projectSlug);
  if (compactMetadata) query.set("compact_metadata", "true");
  return await core.requestJson(
    origin,
    apiPath`/organizations/${organizationSlug}/preprodartifacts/snapshots/latest-base/` +
      `?${query.toString()}`,
  );
}
