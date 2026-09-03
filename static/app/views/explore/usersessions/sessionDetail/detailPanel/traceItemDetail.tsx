import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {SESSION_ID} from '@sentry/conventions/attributes';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {HiddenLogDetailFields} from 'sentry/views/explore/logs/constants';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogSeverityLevel} from 'sentry/views/explore/logs/utils';
import {HiddenTraceMetricDetailFields} from 'sentry/views/explore/metrics/constants';
import {TraceItemDataset} from 'sentry/views/explore/types';
import type {SessionDatasetKey} from 'sentry/views/explore/usersessions/datasets';
import type {SessionEvent} from 'sentry/views/explore/usersessions/sessionDetail/useSessionDetail';
import {SessionIdLink} from 'sentry/views/explore/usersessions/sessionLink';

const REFERRER = 'api.explore.user-session-item-details';

/** The three kinds the trace-items endpoint can address. */
export type TraceItemKey = Extract<SessionDatasetKey, 'traces' | 'logs' | 'metrics'>;

export function isTraceItemKey(key: SessionDatasetKey): key is TraceItemKey {
  return key !== 'errors' && key !== 'feedback';
}

/**
 * Which trace-item type each kind is on the details endpoint, and which of its
 * attributes the explore pages already decided not to show. Reusing their lists
 * rather than writing a third one keeps a log's attributes reading the same here
 * as in the logs explorer.
 *
 * `traces` resolves to spans: what a trace row is addressed by is its segment
 * span, and these are that span's own attributes. The rest of the trace is loaded
 * separately — see `traceDetail`.
 */
const TRACE_ITEM_CONFIG: Record<
  TraceItemKey,
  {hiddenFields: readonly string[]; traceItemType: TraceItemDataset}
> = {
  traces: {traceItemType: TraceItemDataset.SPANS, hiddenFields: []},
  logs: {traceItemType: TraceItemDataset.LOGS, hiddenFields: HiddenLogDetailFields},
  metrics: {
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hiddenFields: HiddenTraceMetricDetailFields,
  },
};

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

/** `project.id` comes back numeric; the details endpoint keys projects by it. */
function projectIdOf(value: unknown): string {
  return typeof value === 'number' || typeof value === 'string' ? String(value) : '';
}

/**
 * A span, log or metric in full: whatever the row already carries, plus every
 * attribute the item has, fetched from the trace-items endpoint.
 *
 * All three go through one component because on that endpoint they differ only by
 * `item_type` and by which attributes they suppress. Errors are not a trace item
 * at all — see `errorDetail`.
 */
export function TraceItemDetail({
  event,
  itemKey,
}: {
  event: SessionEvent;
  itemKey: TraceItemKey;
}) {
  const {traceItemType, hiddenFields} = TRACE_ITEM_CONFIG[itemKey];
  const traceItemId = str(event.row.id);
  const traceId = str(event.row.trace);
  const projectId = projectIdOf(event.row['project.id']);

  const {data, isLoading, isError} = useTraceItemDetails({
    traceItemId: traceItemId ?? '',
    projectId,
    traceId: traceId ?? '',
    traceItemType,
    referrer: REFERRER,
    timestamp: event.timestamp,
    enabled: Boolean(traceItemId && traceId && projectId),
  });

  // The endpoint addresses an item by project, trace and id together; without all
  // three there is nothing to ask for. The panel still shows everything the
  // timeline row carried, which is why this is a note rather than an error.
  if (!traceItemId || !traceId || !projectId) {
    return (
      <Text size="sm" variant="muted">
        {t('No further details are available for this item.')}
      </Text>
    );
  }

  if (isLoading) {
    return (
      <Stack gap="md">
        <Placeholder height="16px" width="60%" />
        <Placeholder height="200px" />
      </Stack>
    );
  }

  if (isError || !data) {
    return <LoadingError message={t('Failed to load details for this item.')} />;
  }

  const attributes = data.attributes.filter(
    attribute => !hiddenFields.includes(attribute.name)
  );

  return (
    <Stack gap="xl">
      <Highlight event={event} itemKey={itemKey} attributes={data.attributes} />
      {itemKey === 'logs' ? (
        <LogAttributes attributes={attributes} data={data} projectId={projectId} />
      ) : (
        <PlainAttributes attributes={attributes} meta={data.meta} projectId={projectId} />
      )}
    </Stack>
  );
}

/**
 * The one piece of the item worth reading before its attribute list: a log's
 * message, a metric's value, a trace's segment-span description. Taken from the
 * fetched attributes rather than the row, which the timeline had already
 * truncated.
 */
function Highlight({
  event,
  itemKey,
  attributes,
}: {
  attributes: TraceItemResponseAttribute[];
  event: SessionEvent;
  itemKey: TraceItemKey;
}) {
  const theme = useTheme();

  const byName = (name: string) =>
    attributes.find(attribute => attribute.name === name)?.value;

  if (itemKey === 'logs') {
    const severity = str(event.row.severity);
    const colors = getLogColors(getLogSeverityLevel(null, severity ?? null), theme);
    const message = String(byName(OurLogKnownFieldKey.MESSAGE) ?? event.title);
    return (
      <MessageBlock style={{borderLeftColor: colors.background}}>
        <Text size="sm" as="p">
          {message}
        </Text>
      </MessageBlock>
    );
  }

  if (itemKey === 'metrics') {
    const value = byName('value') ?? event.row.value;
    const unit = str(byName('metric.unit'));
    return (
      <Text size="lg" bold tabular>
        {typeof value === 'number' || typeof value === 'string'
          ? `${value}${unit ? ` ${unit}` : ''}`
          : '—'}
      </Text>
    );
  }

  const description = String(byName('span.description') ?? event.title);
  return (
    <Text size="sm" as="p" monospace>
      {description}
    </Text>
  );
}

/**
 * Log attributes with the logs explorer's own renderers, so a severity or a
 * timestamp reads there and here alike. The extra they need is assembled from the
 * response the same way the logs table's expanded row does it.
 */
function LogAttributes({
  attributes,
  data,
  projectId,
}: {
  attributes: TraceItemResponseAttribute[];
  data: TraceItemDetailsResponse;
  projectId: string;
}) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const project = useProjectFromId({project_id: projectId});

  const severity = data.attributes.find(
    attribute => attribute.name === OurLogKnownFieldKey.SEVERITY
  )?.value;
  const logColors = getLogColors(
    getLogSeverityLevel(null, typeof severity === 'string' ? severity : null),
    theme
  );

  const values: RendererExtra['attributes'] = {};
  const types: RendererExtra['attributeTypes'] = {};
  data.attributes.forEach(attribute => {
    values[attribute.name] = attribute.value;
    types[attribute.name] = attribute.type;
  });

  return (
    <AttributesTree<RendererExtra>
      columnCount={1}
      attributes={attributes}
      renderers={LogAttributesRendererMap}
      rendererExtra={{
        attributes: values,
        attributeTypes: types,
        caseSensitiveHighlighting: true,
        datetime: selection.datetime,
        highlightTerms: [],
        logColors,
        location,
        navigate,
        organization,
        project,
        projectSlug: project?.slug,
        theme,
        traceItemMeta: data.meta,
        // The panel is opened deliberately, so nothing here is speculative.
        disableLazyLoad: true,
      }}
    />
  );
}

/** Span and metric attributes, with `session.id` linked back to its session. */
function PlainAttributes({
  attributes,
  meta,
  projectId,
}: {
  attributes: TraceItemResponseAttribute[];
  meta: TraceItemDetailsResponse['meta'];
  projectId: string;
}) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  return (
    <AttributesTree
      columnCount={1}
      attributes={attributes}
      renderers={{
        [SESSION_ID]: ({item}) => (
          <SessionIdLink organization={organization} sessionId={String(item.value)} />
        ),
      }}
      rendererExtra={{
        location,
        navigate,
        organization,
        theme,
        projectSlug: project?.slug,
        traceItemMeta: meta,
      }}
    />
  );
}

/**
 * A log's message, offset by its severity color. The same signal the rail spends
 * on a row, at the size the message is actually read at.
 */
const MessageBlock = styled(Container)`
  padding-left: ${p => p.theme.space.md};
  border-left: 2px solid ${p => p.theme.tokens.border.primary};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;
