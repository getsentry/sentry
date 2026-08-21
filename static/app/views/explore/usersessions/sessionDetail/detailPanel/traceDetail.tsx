import {useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SessionEvent} from 'sentry/views/explore/usersessions/sessionDetail/useSessionDetail';
import {useTrace} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceMeta} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceMeta';
import {useTraceRootEvent} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {useTraceTree} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceTree';
import type {TracePreferencesState} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {getInitialTracePreferences} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';
import {TraceWaterfall} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {useTraceEventView} from 'sentry/views/performance/newTraceDetails/useTraceEventView';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

const PREFERENCES_KEY = 'user-session-trace-waterfall-preferences';

/**
 * How tall the waterfall gets inside the panel. It virtualizes against its own
 * box, so it needs a height rather than the content-sized one a scrolling drawer
 * body would otherwise give it.
 */
const WATERFALL_HEIGHT = '440px';

/**
 * The waterfall's own detail drawer starts collapsed: this one is already inside
 * a drawer, and the panel above it has just said what the selected row is. It is
 * still there to expand when a span in the trace is worth reading in full.
 */
const DEFAULT_PREFERENCES: TracePreferencesState = {
  drawer: {
    minimized: true,
    sizes: {
      'drawer left': 0.33,
      'drawer right': 0.33,
      'drawer bottom': 0.4,
    },
    layoutOptions: [],
  },
  missing_instrumentation: true,
  autogroup: {
    parent: true,
    sibling: true,
  },
  compressed_timeline: false,
  layout: 'drawer bottom',
  list: {
    width: 0.5,
  },
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/**
 * The trace a session row stands for, drawn by the trace view's own waterfall.
 *
 * The row itself is only the segment span — the one that names the interaction and
 * carries its duration. What actually happened inside it is the rest of the trace,
 * and the waterfall is the thing that reads it: same rows, same colors, same span
 * details on click as the page the panel's "Open Full Trace" button leads to.
 */
export function TraceDetail({event}: {event: SessionEvent}) {
  const preferences = useMemo(
    () => getInitialTracePreferences(PREFERENCES_KEY, DEFAULT_PREFERENCES, 'trace_view'),
    []
  );

  const traceSlug = str(event.row.trace);
  // The row is the trace's segment span, so that is the row the waterfall opens on.
  // Without it the waterfall falls back to the page's query string, which by then
  // may carry a `node` left behind by an earlier trace's waterfall.
  const spanId = str(event.row.id);

  if (!traceSlug) {
    return (
      <Text size="sm" variant="muted">
        {t('This row carries no trace id, so there is no trace to load.')}
      </Text>
    );
  }

  return (
    <TraceStateProvider
      initialPreferences={preferences}
      preferencesStorageKey={PREFERENCES_KEY}
    >
      <SessionTraceWaterfall
        traceSlug={traceSlug}
        timestamp={event.timestamp}
        spanId={spanId}
      />
    </TraceStateProvider>
  );
}

/**
 * The waterfall and the four queries it reads from, assembled the way the trace
 * page and the replay trace tab assemble them.
 */
function SessionTraceWaterfall({
  traceSlug,
  timestamp,
  spanId,
}: {
  /** The segment span the row stands for, selected once the tree is built. */
  spanId: string | undefined;
  /** Epoch ms, as the timeline carries it. */
  timestamp: number | undefined;
  traceSlug: string;
}) {
  const organization = useOrganization();

  // The trace queries bound their range on a timestamp in seconds, which is what
  // puts a trace older than the page's date filter in reach.
  const params = useTraceQueryParams({
    timestamp: timestamp === undefined ? undefined : timestamp / 1000,
  });
  const traceEventView = useTraceEventView(traceSlug, params);
  const meta = useTraceMeta({traceSlug, timestamp: params.timestamp});
  const trace = useTrace({traceSlug, timestamp: params.timestamp});
  const tree = useTraceTree({trace, replay: null});
  const rootEventResults = useTraceRootEvent({
    tree,
    logs: undefined,
    timestamp: params.timestamp,
    traceId: traceSlug,
  });

  return (
    <Stack height={WATERFALL_HEIGHT}>
      <TraceWaterfall
        traceSlug={traceSlug}
        trace={trace}
        tree={tree}
        meta={meta}
        rootEventResults={rootEventResults}
        traceEventView={traceEventView}
        organization={organization}
        source="trace_view"
        replay={null}
        scrollToEventId={spanId}
      />
    </Stack>
  );
}
