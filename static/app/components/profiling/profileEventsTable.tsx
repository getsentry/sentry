import {useCallback} from 'react';
import type {Location} from 'history';

import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import type {GridColumnOrder, GridColumnSortBy} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import UserMisery from 'sentry/components/userMisery';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getTimeStampFromTableDateField} from 'sentry/utils/dates';
import EventView from 'sentry/utils/discover/eventView';
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import type {EventsResults} from 'sentry/utils/profiling/hooks/types';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {QuickContextHoverWrapper} from 'sentry/views/discover/table/quickContext/quickContextWrapper';
import {ContextType} from 'sentry/views/discover/table/quickContext/utils';
import {
  type DomainView,
  useDomainViewFilters,
} from 'sentry/views/insights/pages/useFilters';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {profilesRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionProfiles/utils';

interface ProfileEventsTableProps<F extends FieldType> {
  columns: readonly F[];
  data: EventsResults<F> | null;
  error: string | null;
  isLoading: boolean;
  sort: GridColumnSortBy<F>;
  sortableColumns?: Set<F>;
}

export function ProfileEventsTable<F extends FieldType>(
  props: ProfileEventsTableProps<F>
) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const domainViewFilters = useDomainViewFilters();

  const generateSortLink = useCallback(
    (column: F) => () => {
      let dir = 'desc';
      if (column === props.sort.key && props.sort.order === dir) {
        dir = 'asc';
      }
      return {
        ...location,
        query: {
          ...location.query,
          sort: dir === 'asc' ? column : `-${column}`,
        },
      };
    },
    [location, props.sort]
  );

  return (
    <GridEditable
      isLoading={props.isLoading}
      error={props.error}
      data={props.data?.data ?? []}
      columnOrder={props.columns.map(field => getColumnOrder<F>(field))}
      columnSortBy={[props.sort]}
      grid={{
        renderHeadCell: renderTableHead<F>({
          currentSort: props.sort,
          generateSortLink,
          rightAlignedColumns: getRightAlignedColumns(props.columns),
          sortableColumns: props.sortableColumns,
        }),
        renderBodyCell: renderTableBody(
          props.data?.meta ?? ({fields: {}, units: {}} as EventsResults<F>['meta']),
          {location, organization, projects, view: domainViewFilters?.view}
        ),
      }}
    />
  );
}

type RenderBagger = {
  location: Location;
  organization: Organization;
  projects: Project[];
  view?: DomainView;
};

function renderTableBody<F extends FieldType>(
  meta: EventsResults<F>['meta'],
  baggage: RenderBagger
) {
  function _renderTableBody(
    column: GridColumnOrder<F>,
    dataRow: Record<F, any>,
    rowIndex: number,
    columnIndex: number
  ) {
    return (
      <ProfileEventsCell
        meta={meta}
        baggage={baggage}
        column={column}
        dataRow={dataRow}
        rowIndex={rowIndex}
        columnIndex={columnIndex}
      />
    );
  }

  return _renderTableBody;
}

interface ProfileEventsCellProps<F extends FieldType> {
  baggage: RenderBagger;
  column: GridColumnOrder<F>;
  columnIndex: number;
  dataRow: {
    [key: string]: any;
  };
  meta: EventsResults<F>['meta'];
  rowIndex: number;
}

function ProfileEventsCell<F extends FieldType>(props: ProfileEventsCellProps<F>) {
  const key = props.column.key;
  const value = props.dataRow[key];
  const columnType = props.meta.fields[key];
  const columnUnit = props.meta.units[key];

  if (key === 'id' || key === 'profile.id') {
    const project = getProjectForRow(props.baggage, props.dataRow);

    if (!defined(project)) {
      // should never happen but just in case
      return <Container>{getShortEventId(value)}</Container>;
    }

    const flamegraphTarget = generateProfileFlamechartRoute({
      orgSlug: props.baggage.organization.slug,
      projectSlug: project.slug,
      profileId: value,
    });

    return (
      <Container>
        <Link to={flamegraphTarget}>{getShortEventId(value)}</Link>
      </Container>
    );
  }

  if (key === 'trace') {
    const traceId = props.dataRow[key] ?? '';
    if (!traceId) {
      return <Container>{t('n/a')}</Container>;
    }
    const timestamp = getTimeStampFromTableDateField(props.dataRow.timestamp);
    const dataSelection = EventView.fromLocation(
      props.baggage.location
    ).normalizeDateSelection(props.baggage.location);

    return (
      <Container>
        <Link
          to={getTraceDetailsUrl({
            organization: props.baggage.organization,
            traceSlug: traceId,
            dateSelection: dataSelection,
            timestamp,
            location: props.baggage.location,
            view: props.baggage.view,
          })}
        >
          {getShortEventId(traceId)}
        </Link>
      </Container>
    );
  }

  if (key === 'trace.transaction') {
    const project = getProjectForRow(props.baggage, props.dataRow);
    const transactionId = getShortEventId(props.dataRow[key] ?? '');
    if (!project) {
      return <Container>{transactionId}</Container>;
    }

    return (
      <Container>
        <Link
          to={generateLinkToEventInTraceView({
            projectSlug: project.slug,
            eventId: props.dataRow[key],
            traceSlug: props.dataRow.trace,
            timestamp: props.dataRow.timestamp,
            location: props.baggage.location,
            transactionName: props.dataRow.transaction,
            organization: props.baggage.organization,
          })}
        >
          {transactionId}
        </Link>
      </Container>
    );
  }

  if (key === 'project.id' || key === 'project' || key === 'project.name') {
    const project = getProjectForRow(props.baggage, props.dataRow);

    if (!defined(project)) {
      // should never happen but just in case
      return <Container>{t('n/a')}</Container>;
    }

    return (
      <Container>
        <ProjectBadge project={project} avatarSize={16} />
      </Container>
    );
  }

  if (key === 'transaction') {
    const project = getProjectForRow(props.baggage, props.dataRow);

    if (defined(project)) {
      const linkToSummary = profilesRouteWithQuery({
        query: props.baggage.location.query,
        orgSlug: props.baggage.organization.slug,
        projectID: project.id,
        transaction: props.dataRow.transaction,
      });

      return (
        <Container>
          <Link
            to={linkToSummary}
            onClick={() =>
              trackAnalytics('profiling_views.go_to_transaction', {
                organization: props.baggage.organization,
                source: 'profiling.landing.transaction_table',
              })
            }
          >
            {props.dataRow.transaction}
          </Link>
        </Container>
      );
    }

    // let this fall through and use one of the other renderers
  }

  if (key === 'release') {
    if (value) {
      return (
        <QuickContextHoverWrapper
          dataRow={props.dataRow}
          contextType={ContextType.RELEASE}
          organization={props.baggage.organization}
        >
          <Version version={value} truncate />
        </QuickContextHoverWrapper>
      );
    }
  }

  if (key === 'user_misery()') {
    return (
      <UserMisery
        bars={10}
        barHeight={20}
        miserableUsers={undefined}
        miseryLimit={undefined}
        totalUsers={undefined}
        userMisery={value || 0}
      />
    );
  }

  switch (columnType) {
    case 'integer':
    case 'number':
      return (
        <NumberContainer>
          <Count value={value} />
        </NumberContainer>
      );
    case 'duration':
      const multiplier = columnUnit ? DURATION_UNITS[columnUnit as string] ?? 1 : 1;
      return (
        <NumberContainer>
          <PerformanceDuration milliseconds={value * multiplier} abbreviation />
        </NumberContainer>
      );
    case 'date':
      return (
        <Container>
          <DateTime date={value} year seconds timeZone />
        </Container>
      );
    default:
      return <Container>{value}</Container>;
  }
}

function getProjectForRow<F extends FieldType>(
  baggage: ProfileEventsCellProps<F>['baggage'],
  dataRow: ProfileEventsCellProps<F>['dataRow']
) {
  let project: Project | undefined = undefined;

  if (defined(dataRow['project.id'])) {
    const projectId = dataRow['project.id'].toString();
    project = baggage.projects.find(proj => proj.id === projectId);
  } else if (defined((dataRow as any).project)) {
    const projectSlug = (dataRow as any).project;
    project = baggage.projects.find(proj => proj.slug === projectSlug);
  } else if (defined(dataRow['project.name'])) {
    const projectSlug = dataRow['project.name'];
    project = baggage.projects.find(proj => proj.slug === projectSlug);
  }

  return project ?? null;
}

type FieldType =
  | 'id'
  | 'profile.id'
  | 'profiler.id'
  | 'thread.id'
  | 'trace.transaction'
  | 'trace'
  | 'transaction'
  | 'transaction.duration'
  | 'precise.start_ts'
  | 'precise.finish_ts'
  | 'profile.duration'
  | 'project'
  | 'project.id'
  | 'project.name'
  | 'environment'
  | 'timestamp'
  | 'release'
  | 'platform.name'
  | 'device.arch'
  | 'device.classification'
  | 'device.locale'
  | 'device.manufacturer'
  | 'device.model'
  | 'os.build'
  | 'os.name'
  | 'os.version'
  | 'last_seen()'
  | 'p50()'
  | 'p75()'
  | 'p95()'
  | 'p99()'
  | 'count()'
  | 'user_misery()';

const RIGHT_ALIGNED_FIELDS = new Set<FieldType>([
  'transaction.duration',
  'profile.duration',
  'p50()',
  'p75()',
  'p95()',
  'p99()',
  'count()',
]);

// TODO: add all the columns here
const COLUMN_ORDERS: Record<FieldType, GridColumnOrder<FieldType>> = {
  id: {
    key: 'id',
    name: t('Profile ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  'profile.id': {
    key: 'profile.id',
    name: t('Profile ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  'profiler.id': {
    key: 'profiler.id',
    name: t('Profiler ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  'thread.id': {
    key: 'thread.id',
    name: t('Thread ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  transaction: {
    key: 'transaction',
    name: t('Transaction'),
    width: COL_WIDTH_UNDEFINED,
  },
  'transaction.duration': {
    key: 'transaction.duration',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  trace: {
    key: 'trace',
    name: t('Trace ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  'trace.transaction': {
    key: 'trace.transaction',
    name: t('Transaction ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  'precise.start_ts': {
    key: 'precise.start_ts',
    name: t('Precise Start Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  'precise.finish_ts': {
    key: 'precise.finish_ts',
    name: t('Precise Finish Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  'profile.duration': {
    key: 'profile.duration',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  project: {
    key: 'project',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  'project.id': {
    key: 'project.id',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  'project.name': {
    key: 'project.name',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  environment: {
    key: 'environment',
    name: t('Environment'),
    width: COL_WIDTH_UNDEFINED,
  },
  timestamp: {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  release: {
    key: 'release',
    name: t('Release'),
    width: COL_WIDTH_UNDEFINED,
  },
  'platform.name': {
    key: 'platform.name',
    name: t('Platform'),
    width: COL_WIDTH_UNDEFINED,
  },
  'device.arch': {
    key: 'device.arch',
    name: t('Device Architecture'),
    width: COL_WIDTH_UNDEFINED,
  },
  'device.classification': {
    key: 'device.classification',
    name: t('Device Classification'),
    width: COL_WIDTH_UNDEFINED,
  },
  'device.locale': {
    key: 'device.locale',
    name: t('Device Locale'),
    width: COL_WIDTH_UNDEFINED,
  },
  'device.manufacturer': {
    key: 'device.manufacturer',
    name: t('Device Manufacturer'),
    width: COL_WIDTH_UNDEFINED,
  },
  'device.model': {
    key: 'device.model',
    name: t('Device Model'),
    width: COL_WIDTH_UNDEFINED,
  },
  'os.build': {
    key: 'os.build',
    name: t('OS Build'),
    width: COL_WIDTH_UNDEFINED,
  },
  'os.name': {
    key: 'os.name',
    name: t('OS Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  'os.version': {
    key: 'os.version',
    name: t('OS Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  'last_seen()': {
    key: 'last_seen()',
    name: t('Last Seen'),
    width: COL_WIDTH_UNDEFINED,
  },
  'p50()': {
    key: 'p50()',
    name: t('P50()'),
    width: COL_WIDTH_UNDEFINED,
  },
  'p75()': {
    key: 'p75()',
    name: t('P75()'),
    width: COL_WIDTH_UNDEFINED,
  },
  'p95()': {
    key: 'p95()',
    name: t('P95()'),
    width: COL_WIDTH_UNDEFINED,
  },
  'p99()': {
    key: 'p99()',
    name: t('P99()'),
    width: COL_WIDTH_UNDEFINED,
  },
  'count()': {
    key: 'count()',
    name: t('Count()'),
    width: COL_WIDTH_UNDEFINED,
  },
  'user_misery()': {
    key: 'user_misery()',
    name: t('User Misery'),
    width: 110,
  },
};

function getColumnOrder<F extends FieldType>(field: F): GridColumnOrder<F> {
  if (COLUMN_ORDERS[field as string]) {
    return COLUMN_ORDERS[field as string] as GridColumnOrder<F>;
  }

  return {
    key: field,
    name: field,
    width: COL_WIDTH_UNDEFINED,
  };
}

function getRightAlignedColumns<F extends FieldType>(columns: readonly F[]): Set<F> {
  return new Set(columns.filter(col => RIGHT_ALIGNED_FIELDS.has(col)));
}
