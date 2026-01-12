import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container as ScrapsContainer} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TimeSince from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer, nullableValue} from 'sentry/utils/discover/fieldRenderers';
import {Container} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import {
  useReadQueriesFromLocation,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  useQueryParamsQuery,
  useSetQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {
  getSimilarEventsUrl,
  isPartialSpanOrTraceData,
} from 'sentry/views/explore/tables/tracesTable/utils';
import {SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface FieldProps {
  data: EventData;
  meta: MetaType;
  column?: TableColumn<keyof TableDataRow>;
  unit?: string;
  usePortalOnDropdown?: boolean;
}

export function FieldRenderer({
  data,
  meta,
  unit,
  column,
  usePortalOnDropdown,
}: FieldProps) {
  const userQuery = useQueryParamsQuery();
  const setUserQuery = useSetQueryParamsQuery();

  return (
    <BaseExploreFieldRenderer
      data={data}
      meta={meta}
      unit={unit}
      column={column}
      userQuery={userQuery}
      setUserQuery={setUserQuery}
      usePortalOnDropdown={usePortalOnDropdown}
    />
  );
}

interface MultiQueryFieldProps extends FieldProps {
  index: number;
}

export function MultiQueryFieldRenderer({
  data,
  meta,
  unit,
  column,
  index,
}: MultiQueryFieldProps) {
  const queries = useReadQueriesFromLocation();
  const userQuery = queries[index]?.query ?? '';
  const updateQuerySearch = useUpdateQueryAtIndex(index);

  return (
    <BaseExploreFieldRenderer
      data={data}
      meta={meta}
      unit={unit}
      column={column}
      userQuery={userQuery}
      setUserQuery={(query: string) => updateQuerySearch({query})}
    />
  );
}

interface BaseFieldProps extends FieldProps {
  setUserQuery: (query: string) => void;
  userQuery: string;
  usePortalOnDropdown?: boolean;
}

function BaseExploreFieldRenderer({
  data,
  meta,
  unit,
  column,
  userQuery,
  setUserQuery,
  usePortalOnDropdown,
}: BaseFieldProps) {
  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();
  const {selection} = usePageFilters();
  const dateSelection = EventView.fromLocation(location).normalizeDateSelection(location);
  const query = new MutableSearch(userQuery);
  const {projects} = useProjects();
  const projectsMap = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.slug] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  const project = projectsMap[data.project];

  if (!defined(column)) {
    return nullableValue(null);
  }

  const field = String(column.key);

  const otelFriendlyUI = organization?.features.includes('performance-otel-friendly-ui');
  const renderer = getExploreFieldRenderer(field, meta, projectsMap, otelFriendlyUI);

  let rendered = renderer(data, {
    location,
    organization,
    theme,
    unit,
  });

  if (field === 'timestamp') {
    const date = new Date(data.timestamp);
    rendered = <StyledTimeSince unitStyle="short" date={date} tooltipShowSeconds />;
  }

  if (field === 'trace') {
    if (isPartialSpanOrTraceData(data.timestamp)) {
      const queryString = new MutableSearch('');

      if (data?.['span.name']) {
        queryString.addFilterValue('span.name', data['span.name']);
      }

      if (data?.['span.description']) {
        queryString.addFilterValue('span.description', data['span.description']);
      }
      return (
        <ScrapsContainer maxWidth="fit-content">
          <Tooltip
            isHoverable
            showUnderline
            title={
              <Text>
                {tct(
                  'Trace is older than 30 days. [similarTraces] in the past 24 hours.',
                  {
                    similarTraces: (
                      <Link
                        to={getSimilarEventsUrl({
                          queryString: queryString.formatString(),
                          table: 'trace',
                          organization,
                          projectIds: defined(project?.id)
                            ? [parseInt(project.id, 10)]
                            : selection.projects,
                          selection,
                        })}
                      >
                        {t('View similar traces')}
                      </Link>
                    ),
                  }
                )}
              </Text>
            }
          >
            <Text variant="muted">{rendered}</Text>
          </Tooltip>
        </ScrapsContainer>
      );
    }

    const target = getTraceDetailsUrl({
      traceSlug: data.trace,
      timestamp: data.timestamp,
      organization,
      dateSelection,
      location,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;
  }

  if (['id', 'span_id', 'transaction.id'].includes(field)) {
    const spanId = field === 'transaction.id' ? undefined : (data.span_id ?? data.id);

    if (isPartialSpanOrTraceData(data.timestamp)) {
      const queryString = new MutableSearch('');

      if (field === 'transaction.id') {
        queryString.addFilterValue('is_transaction', 'true');
      }

      if (data?.['span.name']) {
        queryString.addFilterValue('span.name', data['span.name']);
      }

      if (data?.['span.description']) {
        queryString.addFilterValue('span.description', data['span.description']);
      }

      return (
        <ScrapsContainer maxWidth="fit-content">
          <Tooltip
            isHoverable
            showUnderline
            title={
              <Text>
                {tct('Span is older than 30 days. [similarSpans] in the past 24 hours.', {
                  similarSpans: (
                    <Link
                      to={getSimilarEventsUrl({
                        queryString: queryString.formatString(),
                        organization,
                        projectIds: defined(project?.id)
                          ? [parseInt(project.id, 10)]
                          : selection.projects,
                        selection,
                      })}
                    >
                      {t('View similar spans')}
                    </Link>
                  ),
                })}
              </Text>
            }
          >
            <Text variant="muted">{rendered}</Text>
          </Tooltip>
        </ScrapsContainer>
      );
    }

    const target = generateLinkToEventInTraceView({
      traceSlug: data.trace,
      timestamp: data.timestamp,
      targetId: data['transaction.span_id'],
      eventId: undefined,
      organization,
      location,
      spanId,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{rendered}</Link>;

    if (organization.features.includes('discover-cell-actions-v2') && field === 'id') {
      return rendered;
    }
  }

  if (field === 'profile.id') {
    const target = generateProfileFlamechartRouteWithQuery({
      organization,
      projectSlug: data.project,
      profileId: data['profile.id'],
    });
    rendered = <Link to={target}>{rendered}</Link>;
  }

  return (
    <CellAction
      column={column}
      dataRow={data as TableDataRow}
      handleCellAction={(actions, value) => {
        updateQuery(query, actions, column, value);
        setUserQuery(query.formatString());
      }}
      allowActions={ALLOWED_CELL_ACTIONS}
      usePortalOnDropdown={usePortalOnDropdown}
    >
      {rendered}
    </CellAction>
  );
}

function getExploreFieldRenderer(
  field: string,
  meta: MetaType,
  projects: Record<string, Project>,
  otelFriendlyUI: boolean
): ReturnType<typeof getFieldRenderer> {
  if (field === 'id' || field === 'span_id') {
    return eventIdRenderFunc(field);
  }
  if (field === 'span.description' && !otelFriendlyUI) {
    return spanDescriptionRenderFunc('span.description', projects);
  }
  if (field === SpanFields.NAME && otelFriendlyUI) {
    return spanDescriptionRenderFunc(SpanFields.NAME, projects);
  }
  return getFieldRenderer(field, meta, false);
}

function eventIdRenderFunc(field: string) {
  function renderer(data: EventData) {
    const spanId: string | unknown = data?.[field];
    if (typeof spanId !== 'string') {
      return null;
    }

    return <Container>{getShortEventId(spanId)}</Container>;
  }
  return renderer;
}

function spanDescriptionRenderFunc(field: string, projects: Record<string, Project>) {
  function renderer(data: EventData) {
    const project = projects[data.project];

    const value = data[field];

    return (
      <span>
        <Tooltip
          title={value}
          containerDisplayMode="block"
          showOnlyOnOverflow
          maxWidth={400}
        >
          <Description>
            {project && (
              <ProjectBadge
                project={project ? project : {slug: data.project}}
                avatarSize={16}
                avatarProps={{hasTooltip: true, tooltip: project.slug}}
                hideName
                disableLink
              />
            )}
            <WrappingText>
              {isValidUrl(value) ? (
                <ExternalLink href={value}>{value}</ExternalLink>
              ) : (
                nullableValue(value)
              )}
            </WrappingText>
          </Description>
        </Tooltip>
      </span>
    );
  }
  return renderer;
}

const StyledTimeSince = styled(TimeSince)`
  width: fit-content;
`;

const Description = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;

const WrappingText = styled('div')`
  ${p => p.theme.overflowEllipsis};
  width: auto;
`;
