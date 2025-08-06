import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TimeSince from 'sentry/components/timeSince';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {nullableValue} from 'sentry/utils/discover/fieldRenderers';
import {BaseFieldRenderer} from 'sentry/utils/discover/fieldRenderers/baseFieldRenderers';
import {Container} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {isUrl} from 'sentry/utils/string/isUrl';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import CellAction, {updateQuery} from 'sentry/views/discover/table/cellAction';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {ALLOWED_CELL_ACTIONS} from 'sentry/views/explore/components/table';
import {
  useExploreQuery,
  useSetExploreQuery,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {
  useReadQueriesFromLocation,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

interface FieldProps {
  data: EventData;
  meta: MetaType;
  column?: TableColumn<keyof TableDataRow>;
  unit?: string;
}

export function FieldRenderer({data, meta, unit, column}: FieldProps) {
  const userQuery = useExploreQuery();
  const setUserQuery = useSetExploreQuery();

  return (
    <BaseExploreFieldRenderer
      data={data}
      meta={meta}
      unit={unit}
      column={column}
      userQuery={userQuery}
      setUserQuery={setUserQuery}
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
}

function BaseExploreFieldRenderer({
  data,
  meta,
  unit,
  column,
  userQuery,
  setUserQuery,
}: BaseFieldProps) {
  const location = useLocation();
  const organization = useOrganization();
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

  if (!defined(column)) {
    return nullableValue(null);
  }

  const field = String(column.key);

  let target: LocationDescriptor | undefined;
  let rendered: React.ReactNode | undefined;

  if (field === 'timestamp') {
    const date = new Date(data.timestamp);
    rendered = <StyledTimeSince unitStyle="extraShort" date={date} tooltipShowSeconds />;
  } else if (field === 'trace') {
    target = getTraceDetailsUrl({
      traceSlug: data.trace,
      timestamp: data.timestamp,
      organization,
      dateSelection,
      location,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{formatId(field, data)}</Link>;
  } else if (['id', 'span_id', 'transaction.id'].includes(field)) {
    const spanId = field === 'transaction.id' ? undefined : (data.span_id ?? data.id);
    target = generateLinkToEventInTraceView({
      traceSlug: data.trace,
      timestamp: data.timestamp,
      targetId: data['transaction.span_id'],
      eventId: undefined,
      organization,
      location,
      spanId,
      source: TraceViewSources.TRACES,
    });

    rendered = <Link to={target}>{spanId ? formatId(field, data) : data[field]}</Link>;
  } else if (field === 'profile.id') {
    target = generateProfileFlamechartRouteWithQuery({
      organization,
      projectSlug: data.project,
      profileId: data['profile.id'],
    });
    rendered = <Link to={target}>{formatId(field, data)}</Link>;
  } else if (field === 'span.description') {
    const project = projectsMap[data.project];
    target = project
      ? makeProjectsPathname({
          path: `/${project.slug}/`,
          organization,
        }) + (project.id ? `?project=${project.id}` : '')
      : undefined;
    rendered = spanDescriptionRenderFunc(data, project);
  }

  if (rendered) {
    return (
      <CellAction
        column={column}
        dataRow={data as TableDataRow}
        handleCellAction={(actions, value) => {
          updateQuery(query, actions, column, value);
          setUserQuery(query.formatString());
        }}
        allowActions={ALLOWED_CELL_ACTIONS}
        to={target}
      >
        {rendered}
      </CellAction>
    );
  }

  return (
    <BaseFieldRenderer
      column={column}
      data={data as TableDataRow}
      meta={meta}
      unit={unit}
      allowedActions={ALLOWED_CELL_ACTIONS}
      onSelectAction={(actions, value) => {
        updateQuery(query, actions, column, value);
        setUserQuery(query.formatString());
      }}
    />
  );
}

function formatId(field: string, data: EventData) {
  const id: string | unknown = data?.[field];
  if (typeof id !== 'string') {
    return null;
  }

  return <Container>{getShortEventId(id)}</Container>;
}

function spanDescriptionRenderFunc(data: EventData, project?: Project) {
  const value = data['span.description'];

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
            />
          )}
          <WrappingText>
            {isUrl(value) ? (
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
