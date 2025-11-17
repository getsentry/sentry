import {Flex} from 'sentry/components/core/layout';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {defined} from 'sentry/utils';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {DetectorSearch} from 'sentry/views/detectors/components/detectorSearch';

interface TableHeaderProps {
  showAssigneeFilter?: boolean;
  showTimeRangeSelector?: boolean;
  showTypeFilter?: boolean;
}

export function DetectorListHeader({
  showAssigneeFilter = true,
  showTypeFilter = true,
  showTimeRangeSelector = false,
}: TableHeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const query = typeof location.query.query === 'string' ? location.query.query : '';

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
    <Flex gap="xl">
      <PageFilterBar condensed>
        <ProjectPageFilter />
        {showTimeRangeSelector && <DatePageFilter />}
      </PageFilterBar>
      <div style={{flexGrow: 1}}>
        <DetectorSearch
          initialQuery={query}
          onSearch={onSearch}
          excludeKeys={excludeKeys}
        />
      </div>
    </Flex>
  );
}
