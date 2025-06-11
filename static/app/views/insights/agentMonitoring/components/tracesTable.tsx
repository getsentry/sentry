import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {useTraces} from 'sentry/views/explore/hooks/useTraces';
import {HeadSortCell} from 'sentry/views/insights/agentMonitoring/components/headSortCell';
import {useColumnOrder} from 'sentry/views/insights/agentMonitoring/hooks/useColumnOrder';
import {getAITracesFilter} from 'sentry/views/insights/agentMonitoring/utils/query';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

interface TableData {
  agentFlow: string;
  duration: number;
  errors: number;
  project: string;
  timestamp: number;
  traceId: string;
}

const EMPTY_ARRAY: never[] = [];

const defaultColumnOrder: Array<GridColumnOrder<string>> = [
  {key: 'traceId', name: t('Trace ID'), width: 120},
  {key: 'project', name: t('Project'), width: 180},
  {key: 'agentFlow', name: t('Agent Flow'), width: COL_WIDTH_UNDEFINED},
  {key: 'duration', name: t('Duration'), width: 100},
  {key: 'errors', name: t('Errors'), width: 100},
  {key: 'timestamp', name: t('Timestamp'), width: 120},
];

export function TracesTable() {
  const {columnOrder, onResizeColumn} = useColumnOrder(defaultColumnOrder);

  const tracesRequest = useTraces({
    dataset: DiscoverDatasets.SPANS_EAP,
    query: `${getAITracesFilter()}`,
    sort: '-timestamp',
    limit: 10,
  });

  const tableData = useMemo(() => {
    if (!tracesRequest.data) {
      return [];
    }

    return tracesRequest.data.data.map(span => ({
      traceId: span.trace,
      project: span.project ?? '',
      agentFlow: span.name ?? '',
      duration: span.duration,
      errors: span.numErrors,
      timestamp: span.start,
    }));
  }, [tracesRequest.data]);

  const renderHeadCell = useCallback((column: GridColumnHeader<string>) => {
    return (
      <HeadSortCell sortKey={column.key} forceCellGrow={column.key === 'agentFlow'}>
        {column.name}
      </HeadSortCell>
    );
  }, []);

  const renderBodyCell = useCallback(
    (column: GridColumnOrder<string>, dataRow: TableData) => {
      return <BodyCell column={column} dataRow={dataRow} />;
    },
    []
  );

  return (
    <Fragment>
      <GridEditableContainer>
        <GridEditable
          isLoading={tracesRequest.isPending}
          error={tracesRequest.error}
          data={tableData}
          columnOrder={columnOrder}
          columnSortBy={EMPTY_ARRAY}
          stickyHeader
          grid={{
            renderBodyCell,
            renderHeadCell,
            onResizeColumn,
          }}
        />
        {tracesRequest.isPlaceholderData && <LoadingOverlay />}
      </GridEditableContainer>
      <Pagination pageLinks={'#'} />
    </Fragment>
  );
}

const BodyCell = memo(function BodyCell({
  column,
  dataRow,
}: {
  column: GridColumnHeader<string>;
  dataRow: TableData;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const project = useMemo(
    () => projects.find(p => p.slug === dataRow.project),
    [projects, dataRow.project]
  );

  const traceViewTarget = getTraceDetailsUrl({
    eventId: dataRow.traceId,
    source: TraceViewSources.LLM_MODULE, // TODO: change source to AGENT_MONITORING
    organization,
    location,
    traceSlug: dataRow.traceId,
    dateSelection: normalizeDateTimeParams(selection),
  });

  switch (column.key) {
    case 'traceId':
      return <Link to={traceViewTarget}>{dataRow.traceId.slice(0, 8)}</Link>;
    case 'project':
      return project ? (
        <ProjectBadge project={project} avatarSize={16} />
      ) : (
        <ProjectBadge project={{slug: dataRow.project}} avatarSize={16} />
      );

    case 'agentFlow':
      return dataRow.agentFlow;
    case 'duration':
      return getDuration(dataRow.duration / 1000, 2, true);
    case 'errors':
      return dataRow.errors;
    case 'timestamp':
      return <TimeSince unitStyle="extraShort" date={new Date(dataRow.timestamp)} />;
    default:
      return null;
  }
});

const GridEditableContainer = styled('div')`
  position: relative;
  margin-bottom: ${space(1)};
`;

const LoadingOverlay = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: ${p => p.theme.background};
  opacity: 0.5;
  z-index: 1;
`;
