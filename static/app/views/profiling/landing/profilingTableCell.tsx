import DateTime from 'sentry/components/dateTime';
import Duration from 'sentry/components/duration';
import Link from 'sentry/components/links/link';
import {IconCheckmark, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';

import {generateFlamegraphRoute} from '../utils';

import {TableColumn, TableDataRow} from './types';

function renderProfilingTableCell({
  organization,
  projects,
}: {
  organization: Organization;
  projects: Project[];
}) {
  return (
    column: TableColumn,
    dataRow: TableDataRow,
    _rowIndex: number,
    _columnIndex: number
  ) => {
    const value = dataRow[column.key];

    switch (column.key) {
      case 'id':
        const project = projects.find(proj => proj.id === dataRow.app_id);
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
      case 'failed':
        return (
          <Container>
            {status ? (
              <IconClose size="sm" color="red300" isCircled />
            ) : (
              <IconCheckmark size="sm" color="green300" isCircled />
            )}
          </Container>
        );
      case 'start_time_unix':
        return (
          <Container>
            <DateTime date={value * 1000} />
          </Container>
        );
      case 'trace_duration_ms':
        return (
          <NumberContainer>
            <Duration seconds={value / 1000} abbreviation />
          </NumberContainer>
        );
      default:
        return <Container>{value}</Container>;
    }
  };
}

export {renderProfilingTableCell};
