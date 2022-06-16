import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import DateTime from 'sentry/components/dateTime';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Trace} from 'sentry/types/profiling/core';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {
  generateProfileDetailsRoute,
  generateProfileSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {renderTableHead} from 'sentry/utils/profiling/tableRenderer';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

const REQUIRE_PROJECT_COLUMNS: Set<TableColumnKey> = new Set([
  'id',
  'project_id',
  'transaction_name',
]);

interface ProfilesTableProps {
  error: string | null;
  isLoading: boolean;
  traces: Trace[];
  columnOrder?: Readonly<TableColumnKey[]>;
}

function ProfilesTable(props: ProfilesTableProps) {
  const location = useLocation();

  return (
    <Fragment>
      <GridEditable
        isLoading={props.isLoading}
        error={props.error}
        data={props.traces}
        columnOrder={(props.columnOrder ?? DEFAULT_COLUMN_ORDER).map(key => COLUMNS[key])}
        columnSortBy={[]}
        grid={{
          renderHeadCell: renderTableHead(RIGHT_ALIGNED_COLUMNS),
          renderBodyCell: renderProfilesTableCell,
        }}
        location={location}
      />
    </Fragment>
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<TableColumnKey>(['trace_duration_ms']);

function renderProfilesTableCell(
  column: TableColumn,
  dataRow: TableDataRow,
  rowIndex: number,
  columnIndex: number
) {
  return (
    <ProfilesTableCell
      column={column}
      dataRow={dataRow}
      rowIndex={rowIndex}
      columnIndex={columnIndex}
    />
  );
}

interface ProfilesTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

function ProfilesTableCell({column, dataRow}: ProfilesTableCellProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation();

  // Not all columns need the project, so small optimization to avoid
  // the linear lookup for every cell.
  const project = REQUIRE_PROJECT_COLUMNS.has(column.key)
    ? projects.find(proj => proj.id === dataRow.project_id)
    : undefined;

  if (REQUIRE_PROJECT_COLUMNS.has(column.key) && !defined(project)) {
    Sentry.withScope(scope => {
      scope.setFingerprint(['profiles table', 'cell', 'missing project']);
      scope.setTag('cell_key', column.key);
      scope.setTag('missing_project', dataRow.project_id);
      scope.setTag('available_project', projects.length);
      Sentry.captureMessage(`Project ${dataRow.project_id} missing for ${column.key}`);
    });
  }

  const value = dataRow[column.key];

  switch (column.key) {
    case 'id':
      if (!defined(project)) {
        // should never happen but just in case
        return <Container>{getShortEventId(dataRow.id)}</Container>;
      }

      const flamegraphTarget = generateProfileDetailsRoute({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        profileId: dataRow.id,
      });

      return (
        <Container>
          <Link to={flamegraphTarget}>{getShortEventId(dataRow.id)}</Link>
        </Container>
      );
    case 'project_id':
      if (!defined(project)) {
        // should never happen but just in case
        return <Container>{t('n/a')}</Container>;
      }

      return (
        <Container>
          <ProjectBadge project={project} avatarSize={16} />
        </Container>
      );
    case 'transaction_name':
      if (!defined(project)) {
        // should never happen but just in case
        return <Container>{t('n/a')}</Container>;
      }

      const profileSummaryTarget = generateProfileSummaryRouteWithQuery({
        location,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        transaction: dataRow.transaction_name,
      });

      return (
        <Container>
          <Link to={profileSummaryTarget}>{value}</Link>
        </Container>
      );
    case 'version_name':
      return (
        <Container>
          {dataRow.version_code ? t('%s (build %s)', value, dataRow.version_code) : value}
        </Container>
      );
    case 'failed':
      return (
        <Container>
          {value ? (
            <IconClose size="sm" color="red300" isCircled />
          ) : (
            <IconCheckmark size="sm" color="green300" isCircled />
          )}
        </Container>
      );
    case 'timestamp':
      return (
        <Container>
          <DateTime date={value * 1000} year seconds timeZone />
        </Container>
      );
    case 'trace_duration_ms':
      return (
        <NumberContainer>
          <PerformanceDuration milliseconds={value} abbreviation />
        </NumberContainer>
      );
    default:
      return <Container>{value}</Container>;
  }
}

type TableColumnKey = keyof Trace;

type NonTableColumnKey =
  | 'version_code'
  | 'device_locale'
  | 'device_manufacturer'
  | 'backtrace_available'
  | 'error_code'
  | 'error_code_name'
  | 'error_description'
  | 'span_annotations'
  | 'spans'
  | 'trace_annotations';

type TableColumn = GridColumnOrder<TableColumnKey>;

type TableDataRow = Omit<Record<TableColumnKey, any>, NonTableColumnKey> &
  Partial<Record<TableColumnKey, any>>;

type TableColumnOrders = Omit<Record<TableColumnKey, TableColumn>, NonTableColumnKey>;

const DEFAULT_COLUMN_ORDER: TableColumnKey[] = [
  'failed',
  'id',
  'project_id',
  'transaction_name',
  'version_name',
  'timestamp',
  'trace_duration_ms',
  'device_model',
  'device_classification',
];

const COLUMNS: TableColumnOrders = {
  id: {
    key: 'id',
    name: t('Profile ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  project_id: {
    key: 'project_id',
    name: t('Project'),
    width: COL_WIDTH_UNDEFINED,
  },
  failed: {
    key: 'failed',
    name: t('Status'),
    width: 14, // make this as small as possible
  },
  version_name: {
    key: 'version_name',
    name: t('Version'),
    width: COL_WIDTH_UNDEFINED,
  },
  transaction_name: {
    key: 'transaction_name',
    name: t('Transaction Name'),
    width: COL_WIDTH_UNDEFINED,
  },
  timestamp: {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  trace_duration_ms: {
    key: 'trace_duration_ms',
    name: t('Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_model: {
    key: 'device_model',
    name: t('Device Model'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_classification: {
    key: 'device_classification',
    name: t('Device Classification'),
    width: COL_WIDTH_UNDEFINED,
  },
  device_os_version: {
    key: 'device_os_version',
    name: t('Device OS Version'),
    width: COL_WIDTH_UNDEFINED,
  },
};

export {ProfilesTable};
