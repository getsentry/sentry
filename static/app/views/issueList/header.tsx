import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import QueryCount from 'sentry/components/queryCount';
import Tooltip from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconPause, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import useProjects from 'sentry/utils/useProjects';
import IssueListSetAsDefault from 'sentry/views/issueList/issueListSetAsDefault';

import SavedSearchTab from './savedSearchTab';
import {getTabs, IssueSortOptions, Query, QueryCounts, TAB_MAX_COUNT} from './utils';

type Props = {
  displayReprocessingTab: boolean;
  onRealtimeChange: (realtime: boolean) => void;
  organization: Organization;
  query: string;
  queryCounts: QueryCounts;
  realtimeActive: boolean;
  router: InjectedRouter;
  savedSearch: SavedSearch | null;
  selectedProjectIds: number[];
  sort: string;
  queryCount?: number;
} & React.ComponentProps<typeof SavedSearchTab>;

function IssueListHeader({
  organization,
  query,
  sort,
  queryCount,
  queryCounts,
  realtimeActive,
  onRealtimeChange,
  onSavedSearchSelect,
  onSavedSearchDelete,
  savedSearch,
  savedSearchList,
  router,
  displayReprocessingTab,
  selectedProjectIds,
}: Props) {
  const {projects} = useProjects();
  const tabs = getTabs(organization);
  const visibleTabs = displayReprocessingTab
    ? tabs
    : tabs.filter(([tab]) => tab !== Query.REPROCESSING);
  const savedSearchTabActive = !visibleTabs.some(([tabQuery]) => tabQuery === query);
  // Remove cursor and page when switching tabs
  const {cursor: _, page: __, ...queryParms} = router?.location?.query ?? {};
  const sortParam =
    queryParms.sort === IssueSortOptions.INBOX ? undefined : queryParms.sort;

  function trackTabClick(tabQuery: string) {
    // Clicking on inbox tab and currently another tab is active
    if (tabQuery === Query.FOR_REVIEW && query !== Query.FOR_REVIEW) {
      trackAnalyticsEvent({
        eventKey: 'inbox_tab.clicked',
        eventName: 'Clicked Inbox Tab',
        organization_id: organization.id,
      });
    }
  }

  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  const realtimeTitle = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  return (
    <Layout.Header noActionWrap>
      <Layout.HeaderContent>
        <StyledLayoutTitle>{t('Issues')}</StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <IssueListSetAsDefault {...{sort, query, savedSearch, organization}} />
          <Button
            size="sm"
            data-test-id="real-time"
            title={realtimeTitle}
            aria-label={realtimeTitle}
            icon={realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
            onClick={() => onRealtimeChange(!realtimeActive)}
          />
        </ButtonBar>
      </Layout.HeaderActions>
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
      <Layout.HeaderNavTabs underlined>
        {visibleTabs.map(
          ([tabQuery, {name: queryName, tooltipTitle, tooltipHoverable}]) => {
            const to = {
              query: {
                ...queryParms,
                query: tabQuery,
                sort: tabQuery === Query.FOR_REVIEW ? IssueSortOptions.INBOX : sortParam,
              },
              pathname: `/organizations/${organization.slug}/issues/`,
            };

            return (
              <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
                <Link to={to} onClick={() => trackTabClick(tabQuery)}>
                  <Tooltip
                    title={tooltipTitle}
                    position="bottom"
                    isHoverable={tooltipHoverable}
                    delay={SLOW_TOOLTIP_DELAY}
                  >
                    {queryName}{' '}
                    {queryCounts[tabQuery]?.count > 0 && (
                      <Badge
                        type={
                          tabQuery === Query.FOR_REVIEW &&
                          queryCounts[tabQuery]!.count > 0
                            ? 'review'
                            : 'default'
                        }
                      >
                        <QueryCount
                          hideParens
                          count={queryCounts[tabQuery].count}
                          max={queryCounts[tabQuery].hasMore ? TAB_MAX_COUNT : 1000}
                        />
                      </Badge>
                    )}
                  </Tooltip>
                </Link>
              </li>
            );
          }
        )}
        <SavedSearchTab
          organization={organization}
          query={query}
          sort={sort}
          savedSearchList={savedSearchList}
          onSavedSearchSelect={onSavedSearchSelect}
          onSavedSearchDelete={onSavedSearchDelete}
          isActive={savedSearchTabActive}
          queryCount={queryCount}
        />
      </Layout.HeaderNavTabs>
    </Layout.Header>
  );
}

export default IssueListHeader;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;
