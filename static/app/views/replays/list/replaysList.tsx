import {Fragment, useMemo} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Pagination from 'sentry/components/pagination';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjectSdkNeedsUpdate from 'sentry/utils/useProjectSdkNeedsUpdate';
import ReplayTable from 'sentry/views/replays/replayTable';
import {ReplayColumn} from 'sentry/views/replays/replayTable/types';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';
import {REPLAY_LIST_FIELDS} from 'sentry/views/replays/types';

function ReplaysList() {
  const location = useLocation<ReplayListLocationQuery>();
  const organization = useOrganization();

  const eventView = useMemo(() => {
    const query = decodeScalar(location.query.query, '');
    const conditions = new MutableSearch(query);

    return EventView.fromNewQueryWithLocation(
      {
        id: '',
        name: '',
        version: 2,
        fields: REPLAY_LIST_FIELDS,
        projects: [],
        query: conditions.formatString(),
        orderby: decodeScalar(location.query.sort, DEFAULT_SORT),
      },
      location
    );
  }, [location]);

  return (
    <ReplaysListTable
      eventView={eventView}
      location={location}
      organization={organization}
    />
  );
}

const MIN_REPLAY_CLICK_SDK = '7.44.0';

function ReplaysListTable({
  eventView,
  location,
  organization,
}: {
  eventView: EventView;
  location: Location;
  organization: Organization;
}) {
  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    eventView,
    location,
    organization,
  });

  const {
    selection: {projects},
  } = usePageFilters();

  const {needsUpdate: allSelectedProjectsNeedUpdates} = useProjectSdkNeedsUpdate({
    minVersion: MIN_REPLAY_CLICK_SDK,
    organization,
    projectId: projects.map(String),
  });

  const conditions = useMemo(() => {
    return new MutableSearch(decodeScalar(location.query.query, ''));
  }, [location.query.query]);

  const hasReplayClick = conditions.getFilterKeys().some(k => k.startsWith('click.'));

  const visibleCols = [
    ReplayColumn.REPLAY,
    ReplayColumn.OS,
    ReplayColumn.BROWSER,
    ReplayColumn.DURATION,
    ReplayColumn.COUNT_DEAD_CLICKS,
    ReplayColumn.COUNT_RAGE_CLICKS,
    ReplayColumn.COUNT_ERRORS,
    ReplayColumn.ACTIVITY,
  ];

  return (
    <Fragment>
      <ReplayTable
        fetchError={fetchError}
        isFetching={isFetching}
        replays={replays}
        sort={eventView.sorts[0]}
        visibleColumns={visibleCols}
        showDropdownFilters
        emptyMessage={
          allSelectedProjectsNeedUpdates && hasReplayClick ? (
            <Fragment>
              {t('Unindexed search field')}
              <EmptyStateSubheading>
                {tct('Field [field] requires an [sdkPrompt]', {
                  field: <strong>'click'</strong>,
                  sdkPrompt: <strong>{t('SDK version >= 7.44.0')}</strong>,
                })}
              </EmptyStateSubheading>
            </Fragment>
          ) : undefined
        }
      />
      <ReplayPagination
        pageLinks={pageLinks}
        onCursor={(cursor, path, searchQuery) => {
          trackAnalytics('replay.list-paginated', {
            organization,
            direction: cursor?.endsWith(':1') ? 'prev' : 'next',
          });
          browserHistory.push({
            pathname: path,
            query: {...searchQuery, cursor},
          });
        }}
      />
    </Fragment>
  );
}

const EmptyStateSubheading = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ReplayPagination = styled(Pagination)`
  margin-top: 0;
`;

export default ReplaysList;
