import {useMemo} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';

import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {useTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceTree';
import {
  DEFAULT_TRACE_VIEW_PREFERENCES,
  type TracePreferencesState,
} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {useTraceEventView} from 'sentry/views/performance/newTraceDetails/useTraceEventView';
import type {TraceViewQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';
import type {UseTraceScrollToPath} from 'sentry/views/performance/newTraceDetails/useTraceScrollToPath';

import {TraceLink} from './traceLink';

const TRACE_EMBED_PREFERENCES = {
  ...DEFAULT_TRACE_VIEW_PREFERENCES,
  compressed_timeline: false,
  drawer: {
    ...DEFAULT_TRACE_VIEW_PREFERENCES.drawer,
    layoutOptions: [],
    minimized: true,
  },
  layout: 'drawer bottom',
} satisfies TracePreferencesState;

const TRACE_ADDITIONAL_ATTRIBUTES = [
  'thread.id',
  'tags[performance.timeOrigin,number]',
  'gen_ai.operation.type',
  'http.response.status_code',
  'span.status',
];

function TraceWaterfallEmbed({traceId, timestamp, spanId}: EmbedOutput<'trace'>) {
  const organization = useOrganization();
  const timestampSeconds = getTimeStampFromTableDateField(timestamp);

  // Deliberately not `useTraceQueryParams` — that reads the host page's query string first and
  // only falls back to what it is handed, so an embed rendered on a page that already carries
  // `?timestamp=`/`?statsPeriod=` would silently fetch the wrong window. The embed knows its own
  // bounds, so it passes them straight through.
  const queryParams = useMemo(
    (): TraceViewQueryParams => ({
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      timestamp: timestampSeconds,
    }),
    [timestampSeconds]
  );
  const traceEventView = useTraceEventView(traceId, queryParams);

  const trace = useTrace({
    additionalAttributes: TRACE_ADDITIONAL_ATTRIBUTES,
    referrer: 'api.seer.trace-waterfall-embed',
    // Guarantees the focused span survives the trace's node limit, so a truncated trace does not
    // drop the one span Seer is pointing at.
    targetEventId: spanId,
    timestamp: timestampSeconds,
    traceSlug: traceId,
  });
  const meta = useTraceMeta({traceSlug: traceId, timestamp: timestampSeconds});
  const tree = useTraceTree({trace, replay: null});
  const rootEventResults = useTraceRootEvent({
    tree,
    logs: undefined,
    timestamp: timestampSeconds,
    traceId,
  });

  // Same encoding the compact trace link puts in `?node=`, handed to the waterfall directly
  // rather than through the URL.
  const scrollToNode = useMemo(
    (): UseTraceScrollToPath =>
      spanId ? {eventId: spanId, path: [`span-${spanId}`]} : null,
    [spanId]
  );

  return (
    <TraceWaterfall
      disableUrlSync
      hideIfNoData={false}
      meta={meta}
      organization={organization}
      replay={null}
      rootEventResults={rootEventResults}
      scrollToNode={scrollToNode}
      source="seer_embed"
      trace={trace}
      traceEventView={traceEventView}
      traceSlug={traceId}
      tree={tree}
    />
  );
}

export default function TraceBlock(props: EmbedOutput<'trace'>) {
  return (
    <Container
      background="primary"
      border="primary"
      overflow="hidden"
      padding="md"
      radius="md"
    >
      <Stack gap="md">
        <TraceLink {...props} />
        <Container display="flex" height="400px" minWidth="0">
          <TraceStateProvider disableUrlSync initialPreferences={TRACE_EMBED_PREFERENCES}>
            <TraceWaterfallEmbed {...props} />
          </TraceStateProvider>
        </Container>
      </Stack>
    </Container>
  );
}
