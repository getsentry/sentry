import {useEffect, useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';

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

function getWriteKeys(blocks: Block[]): string[] {
  const keys: string[] = [];
  for (const block of blocks) {
    for (const result of block.tool_results ?? []) {
      for (const record of result?.structuredContent?.calls ?? []) {
        if (isSuccessfulSentryWrite(record)) {
          keys.push(`${block.id}:${result?.tool_call_id}:${record.id}`);
        }
      }
    }
  }
  return keys;
}

/**
 * When Seer changes Sentry data (e.g. creates an alert), the page behind the chat is still showing
 * what it fetched before the change. Invalidate every query once a new successful write shows up so
 * the page refetches what it renders and anything cached is refreshed on the next visit.
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
  const seenRef = useRef<{keys: Set<string>; runId: SeerExplorerRunId | null} | null>(
    null
  );

  useEffect(() => {
    if (runId === null || blocks === undefined) {
      return;
    }

    const writeKeys = getWriteKeys(blocks);
    if (seenRef.current?.runId !== runId) {
      seenRef.current = {runId, keys: new Set(writeKeys)};
      return;
    }

    const seen = seenRef.current.keys;
    const newKeys = writeKeys.filter(key => !seen.has(key));
    if (newKeys.length === 0) {
      return;
    }
    newKeys.forEach(key => seen.add(key));
    queryClient.invalidateQueries();
  }, [blocks, runId, queryClient]);
}
