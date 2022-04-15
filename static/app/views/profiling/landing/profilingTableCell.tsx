import DateTime from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {generateFlamegraphRoute} from '../routes';

import {TableColumn, TableDataRow} from './types';

interface ProfilingTableCellProps {
  column: TableColumn;
  columnIndex: number;
  dataRow: TableDataRow;
  rowIndex: number;
}

function ProfilingTableCell({column, dataRow}: ProfilingTableCellProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const project =
    column.key === 'id' || column.key === 'project_id'
      ? projects.find(proj => proj.id === dataRow.project_id)
      : undefined;

  const value = dataRow[column.key];

  switch (column.key) {
    case 'id':
      if (!defined(project)) {
        // should never happen but just in case
        return <Container>{t('n/a')}</Container>;
      }

      const target = generateFlamegraphRoute({
        orgSlug: organization.slug,
        projectSlug: project.slug,
        profileId: dataRow.id,
      });

      return (
        <Container>
          <Link to={target}>{getShortEventId(dataRow.id)}</Link>
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
