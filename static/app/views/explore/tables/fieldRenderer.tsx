import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventData, MetaType} from 'sentry/utils/discover/eventView';
import EventView from 'sentry/utils/discover/eventView';
import {getFieldRenderer, nullableValue} from 'sentry/utils/discover/fieldRenderers';
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

import {ALLOWED_CELL_ACTIONS} from '../components/table';

interface FieldProps {
  column: TableColumn<keyof TableDataRow>;
  data: EventData;
  meta: MetaType;
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

export interface MultiQueryFieldProps extends FieldProps {
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
  const field = column.name;

  const renderer = getExploreFieldRenderer(field, meta);

  let rendered = renderer(data, {
    location,
    organization,
    unit,
  });

  if (field === 'timestamp') {
    const date = new Date(data.timestamp);
    rendered = <StyledTimeSince unitStyle="extraShort" date={date} tooltipShowSeconds />;
  }

  if (field === 'trace') {
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
    const spanId = field === 'transaction.id' ? undefined : data.span_id ?? data.id;
    const target = generateLinkToEventInTraceView({
      projectSlug: data.project,
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
    >
      {rendered}
    </CellAction>
  );
}

function getExploreFieldRenderer(
  field: string,
  meta: MetaType
): ReturnType<typeof getFieldRenderer> {
  if (field === 'id' || field === 'span_id') {
    return eventIdRenderFunc(field);
  }
  if (field === 'span.description') {
    return SpanDescriptionRenderer;
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

function SpanDescriptionRenderer(data: EventData) {
  const {projects} = useProjects();
  const project = projects.find(p => p.slug === data.project);

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
