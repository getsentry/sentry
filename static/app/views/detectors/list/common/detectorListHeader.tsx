import {IconAdd} from '@sentry/icons/add';
import {parseAsString, useQueryStates} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';
import {makeMonitorCreatePathname} from 'sentry/views/detectors/pathnames';
import {getNoPermissionToCreateMonitorsTooltip} from 'sentry/views/detectors/utils/monitorAccessMessages';
import {useCanCreateDetector} from 'sentry/views/detectors/utils/useCanCreateDetector';

const searchParsers = {query: parseAsString.withDefault(''), cursor: parseAsString};

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
  const {selection} = usePageFilters();
  const canCreateDetector = useCanCreateDetector(null);
  const [{query}, setSearchParams] = useQueryStates(searchParsers);
  const project = selection.projects.find(pid => pid !== ALL_ACCESS_PROJECTS);

  const onSearch = (searchQuery: string) => {
    setSearchParams({query: searchQuery, cursor: null}, {history: 'push'});
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
        <LinkButton
          to={{
            pathname: makeMonitorCreatePathname(organization.slug),
            query: {project, detectorType},
          }}
          variant="primary"
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
      </Flex>
    </Flex>
  );
}
