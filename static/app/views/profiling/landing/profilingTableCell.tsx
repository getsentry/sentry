import DateTime from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {
  generateFlamegraphSummaryRoute,
  generateFunctionsRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {TableColumn, TableDataRow} from './types';

const REQUIRE_PROJECT_COLUMNS = new Set(['id', 'project_id', 'transaction_name']);

interface ProfilingTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

function ProfilingTableCell({column, dataRow}: ProfilingTableCellProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation();

  // Not all columns need the project, so small optimization to avoid
  // the linear lookup for every cell.
  const project = REQUIRE_PROJECT_COLUMNS.has(column.key)
    ? projects.find(proj => proj.id === dataRow.project_id)
    : undefined;

  const value = dataRow[column.key];

  switch (column.key) {
    case 'id':
      if (!defined(project)) {
        // should never happen but just in case
        return <Container>{getShortEventId(dataRow.id)}</Container>;
      }

      const flamegraphTarget = generateFlamegraphSummaryRoute({
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

      const functionsTarget = generateFunctionsRouteWithQuery({
        location,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        transaction: dataRow.transaction_name,
        version: dataRow.version_code
          ? `${dataRow.version_name} (build ${dataRow.version_code})`
          : `${dataRow.version_name}`,
      });

      return (
        <Container>
          <Link to={functionsTarget}>{value}</Link>
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
          <DateTime date={value * 1000} />
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

export {ProfilingTableCell};
