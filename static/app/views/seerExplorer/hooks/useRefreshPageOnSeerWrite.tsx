import {useEffect, useRef} from 'react';
import {useQueryClient, type Query} from '@tanstack/react-query';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Organization} from 'sentry/types/organization';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Block, CallRecord, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isSuccessfulSentryWrite(record: CallRecord): boolean {
  return (
    record.kind === 'api' &&
    // Calls served by an external provider (e.g. a code host) don't change Sentry data.
    !record.provider &&
    WRITE_METHODS.has(record.method?.toUpperCase() ?? '') &&
    record.status !== undefined &&
    record.status >= 200 &&
    record.status < 300
  );
}

function getNewWrites(
  blocks: Block[],
  seen: Set<string>
): Array<{key: string; record: CallRecord}> {
  const writes: Array<{key: string; record: CallRecord}> = [];
  for (const block of blocks) {
    for (const result of block.tool_results ?? []) {
      for (const record of result?.structuredContent?.calls ?? []) {
        const key = `${block.id}:${result?.tool_call_id}:${record.id}`;
        if (isSuccessfulSentryWrite(record) && !seen.has(key)) {
          writes.push({key, record});
        }
      }
    }
  }
  return writes;
}

/**
 * The frontend keys org and project routes by slug, but Seer may address them by id.
 */
function resolvePathParam(
  name: string,
  value: string,
  organization: Organization | null
): string {
  if (name === 'organization_id_or_slug' && organization && value === organization.id) {
    return organization.slug;
  }
  if (name === 'project_id_or_slug') {
    return ProjectsStore.getById(value)?.slug ?? value;
  }
  return value;
}

const SCOPE_PATTERNS = [
  /^\/organizations\/[^/]+\/projects\/[^/]+\//,
  /^\/projects\/[^/]+\/[^/]+\//,
  /^\/organizations\/[^/]+\//,
];

/**
 * The same data is often served under more than one scope: a monitor is created under
 * `/organizations/{org}/projects/{project}/detectors/` but listed from
 * `/organizations/{org}/detectors/`, and Seer may write an issue through the unscoped
 * `/issues/{id}/` while the page reads `/organizations/{org}/issues/{id}/`. Comparing the path
 * below the org/project scope lets a write reach those keys too.
 */
function getResourcePath(url: string): string {
  for (const pattern of SCOPE_PATTERNS) {
    if (pattern.test(url)) {
      return url.replace(pattern, '');
    }
  }
  return url.replace(/^\//, '');
}

function isStaleUrl(url: string, prefix: string): boolean {
  if (url.startsWith(prefix)) {
    return true;
  }
  // A write to the org or project itself has no resource path; matching on an empty one would
  // invalidate every query, so those stay limited to their full path.
  const resourcePrefix = getResourcePath(prefix);
  return resourcePrefix !== '' && getResourcePath(url).startsWith(resourcePrefix);
}

/**
 * The API query key URL prefixes a write can have made stale: the written resource, and when the
 * write targeted one item (`.../workflows/{workflow_id}/`) the collection that lists it. A create
 * already posts to the collection. This mirrors what the app's own mutations invalidate, e.g.
 * creating an alert invalidates `/organizations/{org}/workflows/`, which also covers a monitor's
 * connected alerts list.
 *
 * Returns null when the route can't be resolved, so the caller can fall back to invalidating
 * everything rather than leave the page stale.
 */
function getStalePrefixes(
  record: CallRecord,
  organization: Organization | null
): string[] | null {
  if (!record.path) {
    return null;
  }
  const [routePath = ''] = record.path.split('?');
  const templateSegments = routePath
    .replace(/^\/api\/0\//, '/')
    .split('/')
    .filter(Boolean);

  const segments: string[] = [];
  for (const segment of templateSegments) {
    const param = /^\{(.+)\}$/.exec(segment)?.[1];
    if (param === undefined) {
      segments.push(segment);
      continue;
    }
    const value = record.path_params?.[param];
    if (value === undefined) {
      return null;
    }
    segments.push(encodeURIComponent(resolvePathParam(param, value, organization)));
  }
  if (segments.length === 0) {
    return null;
  }

  const toPrefix = (parts: string[]) => `/${parts.join('/')}/`;
  const prefixes = [toPrefix(segments)];
  const targetsItem = /^\{.+\}$/.test(templateSegments.at(-1) ?? '');
  if (targetsItem && segments.length > 1) {
    prefixes.push(toPrefix(segments.slice(0, -1)));
  }
  return prefixes;
}

/**
 * When Seer changes Sentry data (e.g. creates an alert), the page behind the chat is still showing
 * what it fetched before the change. Once a new successful write shows up, invalidate the API
 * queries under the routes it wrote to, so the page refetches what it renders and cached data is
 * refreshed on the next visit.
 *
 * Only completed tool results are read: `live_calls` can't be attributed to a tool call, and a
 * write's status only matters once the execute that made it has finished. Writes already present
 * the first time a run is seen are history, not something that just happened, so they're skipped.
 */
export function useRefreshPageOnSeerWrite({
  blocks,
  runId,
}: {
  blocks: Block[] | undefined;
  runId: SeerExplorerRunId | null;
}) {
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const seenRef = useRef<{keys: Set<string>; runId: SeerExplorerRunId | null} | null>(
    null
  );

  useEffect(() => {
    if (runId === null || blocks === undefined) {
      return;
    }

    if (seenRef.current?.runId !== runId) {
      const existing = getNewWrites(blocks, new Set()).map(write => write.key);
      seenRef.current = {runId, keys: new Set(existing)};
      return;
    }

    const seen = seenRef.current.keys;
    const writes = getNewWrites(blocks, seen);
    if (writes.length === 0) {
      return;
    }
    writes.forEach(write => seen.add(write.key));

    const prefixes: string[] = [];
    for (const {record} of writes) {
      const recordPrefixes = getStalePrefixes(record, organization);
      if (recordPrefixes === null) {
        queryClient.invalidateQueries();
        return;
      }
      prefixes.push(...recordPrefixes);
    }

    queryClient.invalidateQueries({
      predicate: (query: Query) => {
        const url = safeParseQueryKey(query.queryKey)?.url;
        return url !== undefined && prefixes.some(prefix => isStaleUrl(url, prefix));
      },
    });
  }, [blocks, runId, queryClient, organization]);
}
