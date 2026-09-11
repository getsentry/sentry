import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {LogAttributesView} from 'sentry/components/seer/markdown/embeds/components/log/logAttributesView';
import {LogAttributeView} from 'sentry/components/seer/markdown/embeds/components/log/logAttributeView';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilterDatetime} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {toSplicedSorted} from 'sentry/utils/array/toSplicedSorted';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getShortEventId} from 'sentry/utils/events';
import type {TagVariant} from 'sentry/utils/theme/types';
import {unreachable} from 'sentry/utils/unreachable';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useProjects} from 'sentry/utils/useProjects';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  useTraceItemDetails,
  type TraceItemDetailsResponse,
  type TraceItemResponseAttribute,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {AlwaysPresentLogFields} from 'sentry/views/explore/logs/constants';
import type {RendererExtra} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {
  OurLogKnownFieldKey,
  type EventsLogsResult,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {
  getLogRowTimestampMillis,
  getLogSeverityLevel,
  SeverityLevel,
  severityLevelToText,
} from 'sentry/views/explore/logs/utils';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {
  getLogPageFilters,
  getLogRowUrl,
  getLogTimestampMs,
  LOG_DETAILS_REFERRER,
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
    {
      name: OurLogKnownFieldKey.TIMESTAMP,
      type: 'str',
      value: details.timestamp,
    },
    (a, b) => a.name.localeCompare(b.name)
  );
}

/**
 * `Tag` offers the semantic variants rather than the logs table's per-level
 * colors. That is the right trade here: those finer shades exist to be scanned
 * down a column of rows, and a single embedded row has no column.
 */
function severityTagVariant(level: SeverityLevel): TagVariant {
  switch (level) {
    case SeverityLevel.FATAL:
    case SeverityLevel.ERROR:
      return 'danger';
    case SeverityLevel.WARN:
      return 'warning';
    case SeverityLevel.INFO:
      return 'info';
    case SeverityLevel.TRACE:
    case SeverityLevel.DEBUG:
    case SeverityLevel.DEFAULT:
    case SeverityLevel.UNKNOWN:
      return 'muted';
    default:
      unreachable(level);
      return 'muted';
  }
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
  const organization = useOrganization();
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
  // The row wins when the lookup found one: the id carries only the time the
  // SDK minted it, and the +/-5min window exists precisely because that drifts
  // from when the log was ingested. Handing the mint time to a details endpoint
  // that wants the real one would lose the row the lookup just found.
  const lookupTimestampMs =
    rowTimestampMillis(row) ?? getLogTimestampMs({id, projectId, timestamp});

  const project = useProjectFromId({project_id: resolvedProjectId});
  const {fetching: projectsFetching} = useProjects();

  // `useTraceItemDetails` addresses the endpoint by the project's slug, so it
  // disables itself until `useProjectFromId` finds one -- and reports the miss
  // to Sentry unless the caller disabled it too. This is the one condition, and
  // it gates the spinner as well: a disabled query reads as `pending`, so
  // without it a project this viewer cannot see spins forever instead of
  // reaching the error branch.
  const canFetchDetails = Boolean(resolvedProjectId && resolvedTraceId && project);

  // Deliberately not `useExploreLogsTableRow`: that hook additionally waits on
  // the host page's `usePageFilters().isReady`, which the logs table needs and
  // an embed carrying its own trace, project and timestamp does not. Seer
  // renders from the organization layout, so it appears on plenty of pages that
  // mount no `PageFiltersContainer` -- there the gate never opens and the block
  // spins forever.
  const detailsQuery = useTraceItemDetails({
    traceItemId: id,
    projectId: resolvedProjectId ?? '',
    traceId: resolvedTraceId ?? '',
    traceItemType: TraceItemDataset.LOGS,
    referrer: LOG_DETAILS_REFERRER,
    // The details endpoint takes unix seconds, not an ISO string.
    timestamp: lookupTimestampMs === null ? undefined : lookupTimestampMs / 1000,
    enabled: canFetchDetails,
  });
  const details = detailsQuery.data;

  const isResolving = needsResolution && rowQuery.isPending;
  // `projectsFetching` covers the window where the store is still filling.
  const isPending =
    isResolving || projectsFetching || (canFetchDetails && detailsQuery.isPending);
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
    () => ({
      id,
      projectId: resolvedProjectId,
      // The same resolved instant the details lookup used, so the link's window
      // and the breakdown's window agree with the row that was actually found.
      // Falls back to Seer's own timestamp, then to the id, then to retention.
      timestamp:
        lookupTimestampMs === null
          ? undefined
          : new Date(lookupTimestampMs).toISOString(),
    }),
    [id, lookupTimestampMs, resolvedProjectId]
  );
  const datetime = useMemo(
    () => getLogPageFilters(identity, LOG_LOOKUP_WINDOW_MS).datetime,
    [identity]
  );

  return (
    <SeerEmbedBlock
      badge={
        displayTimestampMs === null ? null : (
          <Text size="sm" variant="muted">
            <DateTime date={displayTimestampMs} />
          </Text>
        )
      }
      // The resolved identity, not the raw props: when Seer gave only an id,
      // the link would otherwise scope Explore to My Projects and miss the very
      // row this card just loaded.
      href={getLogRowUrl({organization, ...identity})}
      icon={IconList}
      linkLabel={t('View Log')}
      testId="seer-log-embed"
      title={t('Log %s', getShortEventId(id))}
    >
      {isPending ? (
        <Flex justify="center" padding="md">
          <LoadingIndicator mini />
        </Flex>
      ) : isError ? (
        <Text variant="danger">{t('Unable to load log details')}</Text>
      ) : (
        <Stack gap="lg">
          <Flex align="baseline" gap="sm">
            <Tag variant={severityTagVariant(level)}>{severityLevelToText(level)}</Tag>
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
    </SeerEmbedBlock>
  );
}
