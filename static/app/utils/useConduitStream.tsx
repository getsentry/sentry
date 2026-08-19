import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {QueryKey, UseQueryOptions} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';

const MAX_SEEN_MESSAGE_IDS = 2048;

type StreamEnvelope<TMessage> = {
  event_type: 'stream';
  message_id: string;
  phase: 'PHASE_START' | 'PHASE_DELTA' | 'PHASE_END' | 'PHASE_ERROR';
  sequence: number;
  payload?: TMessage;
};

type ControlEnvelope = {
  control_type: 'server_draining';
  event_type: 'control';
  message_id: string;
};

type StreamQueryOptions<TQueryData, TQueryKey extends QueryKey> = UseQueryOptions<
  ApiResponse<TQueryData>,
  Error,
  TQueryData,
  TQueryKey
>;

type UseConduitStreamOptions<TMessage, TQueryData, TQueryKey extends QueryKey> = {
  enabled: boolean;
  queryOptions: StreamQueryOptions<TQueryData, TQueryKey>;
  fallbackRefetchInterval?: UseQueryOptions<
    ApiResponse<TQueryData>,
    Error,
    ApiResponse<TQueryData>,
    TQueryKey
  >['refetchInterval'];
  onClose?: () => void;
  onConnect?: () => void;
  onMessage?: (message: TMessage) => void;
};

function parseEnvelope(event: MessageEvent): unknown | null {
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
}

function buildConduitUrl({
  channelId,
  lastEventId,
  token,
  url,
}: {
  channelId: string;
  token: string;
  url: string;
  lastEventId?: string;
}) {
  const conduitUrl = new URL(url);
  conduitUrl.searchParams.set('token', token);
  conduitUrl.searchParams.set('channel_id', channelId);

  if (lastEventId !== undefined) {
    conduitUrl.searchParams.set('last_event_id', lastEventId);
  }

  return conduitUrl.toString();
}

export function useConduitStream<TMessage, TQueryData, TQueryKey extends QueryKey>({
  enabled,
  fallbackRefetchInterval,
  onClose,
  onConnect,
  onMessage,
  queryOptions,
}: UseConduitStreamOptions<TMessage, TQueryData, TQueryKey>) {
  const [isConnected, setIsConnected] = useState(false);
  const [streamError, setStreamError] = useState<Error | null>(null);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const channelIdRef = useRef<string | undefined>(undefined);
  const hasConnectedRef = useRef(false);
  const lastEventIdRef = useRef<string | undefined>(undefined);
  const lastSequenceRef = useRef<number | undefined>(undefined);
  const seenMessageIdsRef = useRef(new Set<string>());

  const query = useQuery<
    ApiResponse<TQueryData>,
    Error,
    ApiResponse<TQueryData>,
    TQueryKey
  >({
    ...queryOptions,
    enabled: enabled && queryOptions.enabled !== false,
    refetchInterval: isConnected ? false : fallbackRefetchInterval,
    select: selectJsonWithHeaders,
  });
  const {
    data: queryResponse,
    error: queryError,
    fetchStatus,
    isError,
    isPending,
    refetch,
  } = query;

  const reportClose = useEffectEvent(() => onClose?.());
  const reportConnect = useEffectEvent(() => onConnect?.());
  const reportMessage = useEffectEvent((message: TMessage) => onMessage?.(message));

  const token = queryResponse?.headers['X-Conduit-Token'];
  const channelId = queryResponse?.headers['X-Conduit-Channel-Id'];
  const url = queryResponse?.headers['X-Conduit-Url'];

  useEffect(() => {
    if (!enabled || isPending || isError) {
      return;
    }

    if (!token || !channelId || !url) {
      setStreamError(new Error('Missing Conduit response headers'));
      return;
    }

    if (channelIdRef.current !== channelId) {
      channelIdRef.current = channelId;
      hasConnectedRef.current = false;
      lastEventIdRef.current = undefined;
      lastSequenceRef.current = undefined;
      seenMessageIdsRef.current.clear();
    }

    const eventSource = new EventSource(
      buildConduitUrl({
        channelId,
        lastEventId: lastEventIdRef.current,
        token,
        url,
      })
    );

    const handleOpen = () => {
      setIsConnected(true);
      setStreamError(null);

      if (hasConnectedRef.current) {
        return;
      }

      hasConnectedRef.current = true;
      reportConnect();
    };

    const handleError = () => {
      setIsConnected(false);
      setStreamError(new Error('Conduit connection error'));
    };

    const handleStream = (event: MessageEvent) => {
      lastEventIdRef.current = event.lastEventId;
      const envelope = parseEnvelope(event) as StreamEnvelope<TMessage> | null;

      if (!envelope) {
        setStreamError(new Error('Failed to parse Conduit message'));
        return;
      }

      if (envelope.phase === 'PHASE_END') {
        eventSource.close();
        setIsConnected(false);
        reportClose();
        return;
      }

      if (seenMessageIdsRef.current.has(envelope.message_id)) {
        return;
      }

      if (seenMessageIdsRef.current.size >= MAX_SEEN_MESSAGE_IDS) {
        seenMessageIdsRef.current.clear();
      }
      seenMessageIdsRef.current.add(envelope.message_id);

      if (
        lastSequenceRef.current !== undefined &&
        envelope.sequence <= lastSequenceRef.current
      ) {
        return;
      }
      lastSequenceRef.current = envelope.sequence;

      if (envelope.phase === 'PHASE_DELTA' && envelope.payload !== undefined) {
        reportMessage(envelope.payload);
      }

      if (envelope.phase === 'PHASE_ERROR') {
        setStreamError(new Error('Conduit stream error'));
      }
    };

    const handleControl = (event: MessageEvent) => {
      lastEventIdRef.current = event.lastEventId;
      const envelope = parseEnvelope(event) as ControlEnvelope | null;

      if (!envelope) {
        setStreamError(new Error('Failed to parse Conduit control message'));
        return;
      }

      if (envelope.control_type === 'server_draining') {
        eventSource.close();
        setIsConnected(false);
        void refetch().finally(() => setConnectionAttempt(value => value + 1));
      }
    };

    eventSource.addEventListener('open', handleOpen);
    eventSource.addEventListener('error', handleError);
    eventSource.addEventListener('stream', handleStream);
    eventSource.addEventListener('control', handleControl);

    return () => {
      eventSource.removeEventListener('open', handleOpen);
      eventSource.removeEventListener('error', handleError);
      eventSource.removeEventListener('stream', handleStream);
      eventSource.removeEventListener('control', handleControl);
      eventSource.close();
      setIsConnected(false);
    };
  }, [channelId, connectionAttempt, enabled, isError, isPending, refetch, token, url]);

  return {
    data: queryResponse?.json,
    error: streamError ?? queryError,
    fetchStatus,
    isConnected,
    isPending,
    refetch,
  };
}
