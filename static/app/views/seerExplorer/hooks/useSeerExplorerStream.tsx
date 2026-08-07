import {useCallback, useMemo, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useStream} from 'conduit-client';

import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getCsrfToken} from 'sentry/utils/getCsrfToken';
import {setApiQueryData} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  SeerExplorerResponse,
  SeerExplorerRunId,
} from 'sentry/views/seerExplorer/types';
import {makeSeerExplorerQueryKey} from 'sentry/views/seerExplorer/utils';

/**
 * Window for collapsing invalidate nudges into a single refetch. Seer already
 * coalesces on its side; this guards against bursts that survive the network.
 */
const INVALIDATE_DEBOUNCE_MS = 100;

/**
 * How long to tolerate silence from a stream whose run is still processing
 * before falling back to polling. Covers the case where a run dies without
 * publishing its terminal message, which would otherwise leave the user
 * watching a spinner until Conduit's 120s idle cleanup.
 */
const STREAM_IDLE_TIMEOUT_MS = 30_000;

type TextMessage = {
  block_id: string;
  kind: 'text';
  offset: number;
  text: string;
};

type InvalidateMessage = {
  kind: 'invalidate';
  reason: string;
};

type DoneMessage = {
  kind: 'done';
  status: string;
};

type StreamMessage = TextMessage | InvalidateMessage | DoneMessage;

interface UseSeerExplorerStreamOptions {
  enabled: boolean;
  runId: SeerExplorerRunId | null;
}

export interface SeerExplorerStreamState {
  /** True while a healthy stream is delivering this run's output. */
  isStreaming: boolean;
}

/**
 * Streams a Seer run's output over Conduit, writing into the same React Query
 * cache entry that polling populates.
 *
 * Only assistant text arrives over the wire. Everything structural -- new
 * blocks, tool results, patches, PR state -- arrives as a nudge that triggers
 * one refetch of the existing state endpoint, which stays the source of truth.
 * That keeps this hook from having to model Seer's state shape.
 *
 * The hook is an accelerator, never a dependency: every failure path leaves
 * `isStreaming` false, and the caller's polling covers the gap.
 */
export function useSeerExplorerStream({
  enabled,
  runId,
}: UseSeerExplorerStreamOptions): SeerExplorerStreamState {
  const organization = useOrganization({allowNull: true});
  const queryClient = useQueryClient();
  const orgSlug = organization?.slug;

  const [isConnected, setIsConnected] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const invalidateTimer = useRef<number | undefined>(undefined);
  const idleTimer = useRef<number | undefined>(undefined);
  /** Characters accumulated per block, to detect gaps in the delta sequence. */
  const accumulated = useRef<Map<string, number>>(new Map());

  const queryKey = useMemo(
    () => makeSeerExplorerQueryKey(orgSlug || '', runId),
    [orgSlug, runId]
  );

  const invalidate = useCallback(() => {
    window.clearTimeout(invalidateTimer.current);
    invalidateTimer.current = window.setTimeout(() => {
      queryClient.invalidateQueries({queryKey});
    }, INVALIDATE_DEBOUNCE_MS);
  }, [queryClient, queryKey]);

  const armIdleTimer = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setIsIdle(false);
    idleTimer.current = window.setTimeout(() => setIsIdle(true), STREAM_IDLE_TIMEOUT_MS);
  }, []);

  const appendText = useCallback(
    (message: TextMessage) => {
      const expected = accumulated.current.get(message.block_id) ?? 0;
      if (message.offset !== expected) {
        // A delta went missing (a publish that exhausted its retries, or a
        // reconnect that outran the stream's retention). Refetching is cheap and
        // self-healing; rendering text with a hole in it is neither.
        accumulated.current.delete(message.block_id);
        invalidate();
        return;
      }

      accumulated.current.set(message.block_id, expected + message.text.length);

      // A local cache write, not a fetch -- this is where the latency win is.
      //
      // setApiQueryData is deprecated in favour of queryClient.setQueryData with
      // apiOptions, but it has to be used here: this writes into the entry
      // useSeerExplorerPolling populates via useApiQuery, whose cache values are
      // {json, headers}-shaped. Writing a bare payload would corrupt it. Migrating
      // that hook to apiOptions is the prerequisite for dropping this, and is
      // deliberately not bundled into the streaming change.
      setApiQueryData<SeerExplorerResponse>(queryClient, queryKey, existing => {
        if (!existing?.session) {
          // Nothing to append to yet; the initial fetch hasn't landed.
          return existing;
        }
        const index = existing.session.blocks.findIndex(b => b.id === message.block_id);
        if (index === -1) {
          // The block arrives via the state endpoint, so a delta can beat it here.
          // Refetch rather than fabricate one.
          accumulated.current.delete(message.block_id);
          invalidate();
          return existing;
        }

        const block = existing.session.blocks[index]!;
        const blocks = [...existing.session.blocks];
        blocks[index] = {
          ...block,
          message: {
            ...block.message,
            content: (block.message.content ?? '') + message.text,
          },
        };
        return {...existing, session: {...existing.session, blocks}};
      });
    },
    [invalidate, queryClient, queryKey]
  );

  const onMessage = useCallback(
    (message: StreamMessage) => {
      armIdleTimer();

      switch (message.kind) {
        case 'text':
          appendText(message);
          break;
        case 'invalidate':
          // Structural change. The endpoint knows what it was; we don't need to.
          invalidate();
          break;
        case 'done':
          setIsComplete(true);
          invalidate();
          break;
        default:
          // Forward compatible: a newer Seer may publish kinds this build doesn't
          // know. Refetching is always a safe response to "something happened".
          invalidate();
      }
    },
    [appendText, armIdleTimer, invalidate]
  );

  const onConnect = useCallback(() => {
    // The stream replays recent history on connect, and a reconnect may have
    // missed messages entirely. Resync from the endpoint and rebuild offsets
    // from whatever it returns.
    accumulated.current.clear();
    setIsConnected(true);
    setIsComplete(false);
    armIdleTimer();
    queryClient.invalidateQueries({queryKey});
  }, [armIdleTimer, queryClient, queryKey]);

  const onDisconnect = useCallback(() => {
    window.clearTimeout(idleTimer.current);
    setIsConnected(false);
    accumulated.current.clear();
    // Refetch immediately, for two reasons: whatever the stream was mid-way
    // through delivering is now only available from the endpoint, and React Query
    // recomputes `refetchInterval` after a fetch -- so this is also what promotes
    // the caller back off the slow safety-net interval. Without it, a dropped
    // stream would leave the UI on a 15s cadence until that timer next fired.
    queryClient.invalidateQueries({queryKey});
  }, [queryClient, queryKey]);

  const streamHeaders = useMemo(() => ({'X-CSRFToken': getCsrfToken()}), []);

  const startStreamUrl =
    orgSlug && runId !== null
      ? getApiUrl(
          '/organizations/$organizationIdOrSlug/seer/explorer-chat/$runId/stream-credentials/',
          {path: {organizationIdOrSlug: orgSlug, runId}}
        )
      : '';

  useStream<StreamMessage>({
    enabled: enabled && !!startStreamUrl && !!organization,
    orgId: Number(organization?.id ?? 0),
    startStreamUrl,
    startStreamHeaders: streamHeaders,
    onMessage,
    onConnect,
    onReconnect: onConnect,
    onClose: onDisconnect,
    onError: onDisconnect,
  });

  return {
    // `isComplete` keeps polling off after the run ends: the stream closes on
    // purpose there, and treating that as a failure would restart the timer we
    // just retired.
    isStreaming: (isConnected && !isIdle) || isComplete,
  };
}
