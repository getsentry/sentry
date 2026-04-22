import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

interface TableHeaderProps {
  detectorType?: DetectorType;
  showAssigneeFilter?: boolean;
  showTimeRangeSelector?: boolean;
  showTypeFilter?: boolean;
}

export function DetectorListHeader({
  detectorType,
  showAssigneeFilter = true,
  showTypeFilter = true,
  showTimeRangeSelector = false,
}: TableHeaderProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const {selection} = usePageFilters();
  const hasPageFrameFeature = useHasPageFrameFeature();
  const canCreateDetector = useCanCreateDetector(null);
  const query = typeof location.query.query === 'string' ? location.query.query : '';
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);

  const onSearch = (searchQuery: string) => {
    navigate({
      pathname: location.pathname,
      query: {...location.query, query: searchQuery, cursor: undefined},
    });
  };

  // Exclude filter keys when they're set
  const excludeKeys = [
    showTypeFilter ? null : 'type',
    showAssigneeFilter ? null : 'assignee',
  ].filter(defined);

  return (
    <Flex gap="xl" align="center">
      <PageFilterBar condensed>
        <ProjectPageFilter />
        {showTimeRangeSelector && <DatePageFilter />}
      </PageFilterBar>
      <Flex flex={1} gap="md" align="center">
        <DetectorSearch
          initialQuery={query}
          onSearch={onSearch}
          excludeKeys={excludeKeys}
        />
        {hasPageFrameFeature && (
          <LinkButton
            to={{
              pathname: makeMonitorCreatePathname(organization.slug),
              query: {project, detectorType},
            }}
            priority="primary"
            icon={<IconAdd />}
            size="md"
            disabled={!canCreateDetector}
            tooltipProps={{
              title: canCreateDetector
                ? undefined
                : getNoPermissionToCreateMonitorsTooltip(),
            }}
          >
            {t('Create Monitor')}
          </LinkButton>
        )}
      </Flex>
    </Flex>
  );
}
