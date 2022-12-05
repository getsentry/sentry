import {Fragment, useMemo} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import ReplaysFeatureBadge from 'sentry/components/replays/replaysFeatureBadge';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import EventView from 'sentry/utils/discover/eventView';
import {decodeScalar} from 'sentry/utils/queryString';
import {DEFAULT_SORT, REPLAY_LIST_FIELDS} from 'sentry/utils/replays/fetchReplayList';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {useReplayOnboardingSidebarPanel} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import ReplaysFilters from 'sentry/views/replays/filters';
import ReplayOnboardingPanel from 'sentry/views/replays/list/replayOnboardingPanel';
import ReplayTable from 'sentry/views/replays/replayTable';
import type {ReplayListLocationQuery} from 'sentry/views/replays/types';

type Props = RouteComponentProps<{orgId: string}, {}, any, ReplayListLocationQuery>;

function Replays({location}: Props) {
  const organization = useOrganization();
  const theme = useTheme();
  const minWidthIsSmall = useMedia(`(min-width: ${theme.breakpoints.small})`);

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

  const {replays, pageLinks, isFetching, fetchError} = useReplayList({
    organization,
    eventView,
  });

  const {enabled: shouldShowOnboardingPanel, activateSidebar} =
    useReplayOnboardingSidebarPanel();

  return (
    <Fragment>
      <Layout.Header>
        <StyledLayoutHeaderContent>
          <StyledHeading>
            {t('Replays')} <ReplaysFeatureBadge space={1} />
          </StyledHeading>
        </StyledLayoutHeaderContent>
      </Layout.Header>
      <PageFiltersContainer>
        <StyledPageContent>
          <ReplaysFilters />
          {shouldShowOnboardingPanel ? (
            <ReplayOnboardingPanel>
              <Button onClick={activateSidebar} priority="primary">
                {t('Get Started')}
              </Button>
              <Button
                href="https://github.com/getsentry/sentry-replay/blob/main/README.md"
                external
              >
                {t('See Readme')}
              </Button>
            </ReplayOnboardingPanel>
          ) : (
            <Fragment>
              <ReplayTable
                isFetching={isFetching}
                fetchError={fetchError}
                replays={replays}
                showProjectColumn={minWidthIsSmall}
                sort={eventView.sorts[0]}
              />
              <Pagination
                pageLinks={pageLinks}
                onCursor={(cursor, path, searchQuery) => {
                  browserHistory.push({
                    pathname: path,
                    query: {...searchQuery, cursor},
                  });
                }}
              />
            </Fragment>
          )}
        </StyledPageContent>
      </PageFiltersContainer>
    </Fragment>
  );
}

const StyledLayoutHeaderContent = styled(Layout.HeaderContent)`
  display: flex;
  justify-content: space-between;
  flex-direction: row;
`;

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
  display: flex;
`;

const StyledPageContent = styled(PageContent)`
  box-shadow: 0px 0px 1px ${p => p.theme.gray200};
  background-color: ${p => p.theme.background};
`;

export default Replays;
