import * as React from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Badge from 'app/components/badge';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import GlobalEventProcessingAlert from 'app/components/globalEventProcessingAlert';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import QueryCount from 'app/components/queryCount';
import Tooltip from 'app/components/tooltip';
import {IconPause, IconPlay} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withProjects from 'app/utils/withProjects';

import SavedSearchTab from './savedSearchTab';
import {getTabs, IssueSortOptions, Query, QueryCounts, TAB_MAX_COUNT} from './utils';

type WrapGuideProps = {
  children: React.ReactElement;
  tabQuery: string;
  query: string;
  to: React.ComponentProps<typeof GuideAnchor>['to'];
};

function WrapGuideTabs({children, tabQuery, query, to}: WrapGuideProps) {
  if (tabQuery === Query.FOR_REVIEW) {
    return (
      <GuideAnchor target="inbox_guide_tab" disabled={query === Query.FOR_REVIEW} to={to}>
        <GuideAnchor target="for_review_guide_tab">{children}</GuideAnchor>
      </GuideAnchor>
    );
  }

  return children;
}

type Props = {
  organization: Organization;
  query: string;
  sort: string;
  queryCounts: QueryCounts;
  realtimeActive: boolean;
  router: InjectedRouter;
  onRealtimeChange: (realtime: boolean) => void;
  displayReprocessingTab: boolean;
  selectedProjectIds: number[];
  projects: Project[];
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
  savedSearchList,
  router,
  displayReprocessingTab,
  selectedProjectIds,
  projects,
}: Props) {
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

  return (
    <React.Fragment>
      <BorderlessHeader>
        <StyledHeaderContent>
          <StyledLayoutTitle>{t('Issues')}</StyledLayoutTitle>
        </StyledHeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button
              size="small"
              data-test-id="real-time"
              title={t('%s real-time updates', realtimeActive ? t('Pause') : t('Enable'))}
              onClick={() => onRealtimeChange(!realtimeActive)}
            >
              {realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
            </Button>
          </ButtonBar>
        </Layout.HeaderActions>
        <StyledGlobalEventProcessingAlert projects={selectedProjects} />
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          {visibleTabs.map(
            ([tabQuery, {name: queryName, tooltipTitle, tooltipHoverable}]) => {
              const to = {
                query: {
                  ...queryParms,
                  query: tabQuery,
                  sort:
                    tabQuery === Query.FOR_REVIEW ? IssueSortOptions.INBOX : sortParam,
                },
                pathname: `/organizations/${organization.slug}/issues/`,
              };

              return (
                <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
                  <Link to={to} onClick={() => trackTabClick(tabQuery)}>
                    <WrapGuideTabs query={query} tabQuery={tabQuery} to={to}>
                      <Tooltip
                        title={tooltipTitle}
                        position="bottom"
                        isHoverable={tooltipHoverable}
                        delay={1000}
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
                    </WrapGuideTabs>
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
      </TabLayoutHeader>
    </React.Fragment>
  );
}

export default withProjects(IssueListHeader);

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;
  /* Not enough buttons to change direction for mobile view */
  grid-template-columns: 1fr auto;
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
  margin-right: ${space(2)};
`;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  margin-bottom: 0;
  grid-column: 1/-1;
  margin-top: ${space(2)};
`;
