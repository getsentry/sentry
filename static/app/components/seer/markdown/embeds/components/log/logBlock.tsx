import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {LogAttributesView} from 'sentry/components/seer/markdown/embeds/components/log/logAttributesView';
import {LogAttributeView} from 'sentry/components/seer/markdown/embeds/components/log/logAttributeView';
import {LogLink} from 'sentry/components/seer/markdown/embeds/components/log/logLink';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {toSplicedSorted} from 'sentry/utils/array/toSplicedSorted';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import type {
  TraceItemDetailsResponse,
  TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {useExploreLogsTableRow} from 'sentry/views/explore/logs/useLogsQuery';
import {
  getLogRowTimestampMillis,
  getLogSeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';

import {
  getLogPageFilters,
  getLogTimestampMs,
  LOG_EMBED_REFERRER,
  LOG_LOOKUP_WINDOW_MS,
  toDateQueryParams,
  toProjectId,
  type LogEmbedIdentity,
} from './logUtils';

type LogData = EmbedOutput<'log'>;

/**
 * The details endpoint is addressed by trace and project, but Seer only has to
 * give us the log's id. When it withheld either one, find the row first: it
 * carries both, plus the precise timestamp the details lookup wants.
 */
function useResolvedLogRow({
  enabled,
  id,
  projectId,
  timestamp,
}: LogEmbedIdentity & {enabled: boolean}) {
  const organization = useOrganization();
  const selection = useMemo(
    () => getLogPageFilters({id, projectId, timestamp}, LOG_LOOKUP_WINDOW_MS),
    [id, projectId, timestamp]
  );

  return useQuery({
    ...apiOptions.as<EventsLogsResult>()('/organizations/$organizationIdOrSlug/events/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        dataset: DiscoverDatasets.OURLOGS,
        field: AlwaysPresentLogFields,
        query: `${OurLogKnownFieldKey.ID}:${id}`,
        // Without a project id the row could be in any of them.
        project:
          selection.projects.length > 0 ? selection.projects : [ALL_ACCESS_PROJECTS],
        // The row is a single needle, so never let sampling drop it.
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
        per_page: 1,
        referrer: LOG_EMBED_REFERRER,
        ...toDateQueryParams(selection),
      },
      // A log line never changes once written.
      staleTime: Infinity,
    }),
    enabled,
    retry: false,
  });
}

function toAttributeValues(attributes: TraceItemResponseAttribute[]) {
  return Object.fromEntries(
    attributes.map(attribute => [attribute.name, attribute.value])
  ) as RendererExtra['attributes'];
}

function toAttributeTypes(attributes: TraceItemResponseAttribute[]) {
  return Object.fromEntries(
    attributes.map(attribute => [attribute.name, attribute.type])
  ) as RendererExtra['attributeTypes'];
}

/**
 * The details response keeps the timestamp beside the attributes rather than
 * among them, so splice it back in the way the logs table does.
 */
function toLogAttributes(
  details: TraceItemDetailsResponse
): TraceItemResponseAttribute[] {
  if (details.attributes.some(a => a.name === OurLogKnownFieldKey.TIMESTAMP)) {
    return details.attributes;
  }

  return toSplicedSorted(
    details.attributes,
    {name: OurLogKnownFieldKey.TIMESTAMP, type: 'str', value: details.timestamp},
    (a, b) => a.name.localeCompare(b.name)
  );
}

function rowTimestampMillis(row: OurLogsResponseItem | undefined): number | null {
  if (!row) {
    return null;
  }
  const millis = getLogRowTimestampMillis(row);
  return Number.isFinite(millis) ? millis : null;
}

function parseTimestampMillis(timestamp: string | undefined): number | null {
  const millis = timestamp === undefined ? NaN : new Date(timestamp).getTime();
  return Number.isFinite(millis) ? millis : null;
}

interface LogBlockContentProps {
  attributeTypes: RendererExtra['attributeTypes'];
  attributeValues: RendererExtra['attributes'];
  attributes: TraceItemResponseAttribute[];
  datetime: PageFilterDatetime;
  identity: LogEmbedIdentity;
  logColors: ReturnType<typeof getLogColors>;
  view: LogData['view'];
  attribute?: string;
  projectSlug?: string;
}

/**
 * Dispatches to the one component that knows how to render this view. Adding a
 * view is a new file next to this one, plus a case here.
 */
function LogBlockContent({
  attribute,
  attributes,
  attributeTypes,
  attributeValues,
  datetime,
  identity,
  logColors,
  projectSlug,
  view,
}: LogBlockContentProps) {
  switch (view) {
    case 'summary':
      // The severity, message and timestamp above are the whole summary.
      return null;
    case 'attributes':
      return (
        <LogAttributesView
          attributes={attributes}
          attributeTypes={attributeTypes}
          attributeValues={attributeValues}
          datetime={datetime}
          logColors={logColors}
          projectSlug={projectSlug}
        />
      );
    case 'attribute':
      // `view` is narrowed to 'summary' by the block when no key was given.
      return attribute ? (
        <LogAttributeView attribute={attribute} identity={identity} />
      ) : null;
    default:
      unreachable(view);
      return null;
  }
}

export default function LogBlock(props: LogData) {
  const {id, traceId, timestamp, attribute} = props;
  const projectId = toProjectId(props.projectId);
  const theme = useTheme();

  // A breakdown needs a key to break down; without one there is nothing to
  // render beyond the log itself.
  const view = props.view === 'attribute' && !attribute ? 'summary' : props.view;

  const needsResolution = !traceId || !projectId;
  const rowQuery = useResolvedLogRow({
    enabled: needsResolution,
    id,
    projectId,
    timestamp,
  });
  const row = rowQuery.data?.data?.[0];

  const resolvedTraceId =
    traceId ?? (row?.[OurLogKnownFieldKey.TRACE_ID] as string | undefined);
  const resolvedProjectId =
    projectId ??
    (row === undefined ? undefined : String(row[OurLogKnownFieldKey.PROJECT_ID]));
  const lookupTimestampMs =
    getLogTimestampMs({id, projectId, timestamp}) ?? rowTimestampMillis(row);

  const detailsQuery = useExploreLogsTableRow({
    logId: id,
    projectId: resolvedProjectId ?? '',
    traceId: resolvedTraceId ?? '',
    // The details endpoint takes unix seconds, not an ISO string.
    timestamp: lookupTimestampMs === null ? undefined : lookupTimestampMs / 1000,
    enabled: Boolean(resolvedProjectId && resolvedTraceId),
  });
  const details = detailsQuery.data;
  const project = useProjectFromId({project_id: resolvedProjectId});

  const isResolving = needsResolution && rowQuery.isPending;
  const canFetchDetails = Boolean(resolvedProjectId && resolvedTraceId);
  const isPending = isResolving || (canFetchDetails && detailsQuery.isPending);
  const isError = !isPending && (!canFetchDetails || detailsQuery.isError || !details);

  const attributes = useMemo(() => (details ? toLogAttributes(details) : []), [details]);
  const attributeValues = useMemo(() => toAttributeValues(attributes), [attributes]);
  const attributeTypes = useMemo(() => toAttributeTypes(attributes), [attributes]);

  const level = getLogSeverityLevel(
    Number(attributeValues[OurLogKnownFieldKey.SEVERITY_NUMBER]) || null,
    (attributeValues[OurLogKnownFieldKey.SEVERITY] as string | undefined) ?? null
  );
  const logColors = getLogColors(level, theme);
  const message = attributeValues[OurLogKnownFieldKey.MESSAGE];
  const displayTimestampMs =
    parseTimestampMillis(details?.timestamp) ?? lookupTimestampMs;

  const identity = useMemo<LogEmbedIdentity>(
    () => ({id, projectId: resolvedProjectId, timestamp}),
    [id, resolvedProjectId, timestamp]
  );
  const datetime = useMemo(
    () => getLogPageFilters(identity, LOG_LOOKUP_WINDOW_MS).datetime,
    [identity]
  );

  return (
    <Container
      background="primary"
      border="primary"
      data-test-id="seer-log-embed"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <Flex align="center" gap="md" justify="between" wrap="wrap">
          <LogLink {...props} />
          {displayTimestampMs === null ? null : (
            <Text size="sm" variant="muted">
              <DateTime date={displayTimestampMs} />
            </Text>
          )}
        </Flex>

        {isPending ? (
          <Flex justify="center" padding="md">
            <LoadingIndicator mini />
          </Flex>
        ) : isError ? (
          <Text variant="danger">{t('Unable to load log details')}</Text>
        ) : (
          <Stack gap="lg">
            <Flex align="baseline" gap="sm">
              <SeverityTag logColors={logColors}>
                {severityLevelToText(level)}
              </SeverityTag>
              <Text monospace size="sm">
                {String(message ?? '')}
              </Text>
            </Flex>
            <LogBlockContent
              attribute={attribute}
              attributes={attributes}
              attributeTypes={attributeTypes}
              attributeValues={attributeValues}
              datetime={datetime}
              identity={identity}
              logColors={logColors}
              projectSlug={project?.slug}
              view={view}
            />
          </Stack>
        )}
      </Stack>
    </Container>
  );
}

const SeverityTag = styled('span')<{logColors: ReturnType<typeof getLogColors>}>`
  flex-shrink: 0;
  border: 1px solid ${p => p.logColors.border};
  background: ${p => p.logColors.backgroundLight};
  color: ${p => p.logColors.color};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0 ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  text-transform: uppercase;
  white-space: nowrap;
`;
