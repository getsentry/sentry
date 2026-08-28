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
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

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

function TraceWaterfallEmbed({traceId, timestamp}: EmbedOutput<'trace'>) {
  const organization = useOrganization();
  const timestampSeconds = getTimeStampFromTableDateField(timestamp);
  const queryParams = useTraceQueryParams({timestamp: timestampSeconds});
  const traceEventView = useTraceEventView(traceId, queryParams);
  const trace = useTrace({
    additionalAttributes: TRACE_ADDITIONAL_ATTRIBUTES,
    referrer: 'api.seer.trace-waterfall-embed',
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

  return (
    <TraceWaterfall
      hideIfNoData={false}
      meta={meta}
      organization={organization}
      replay={null}
      rootEventResults={rootEventResults}
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
          <TraceStateProvider initialPreferences={TRACE_EMBED_PREFERENCES}>
            <TraceWaterfallEmbed {...props} />
          </TraceStateProvider>
        </Container>
      </Stack>
    </Container>
  );
}
