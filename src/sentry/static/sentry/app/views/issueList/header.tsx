import React from 'react';
import {InjectedRouter, Link} from 'react-router';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import * as Layout from 'app/components/layouts/thirds';
import QueryCount from 'app/components/queryCount';
import Tooltip from 'app/components/tooltip';
import {IconPause, IconPlay} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import withProjects from 'app/utils/withProjects';

import SavedSearchTab from './savedSearchTab';
import {
  getTabs,
  isForReviewQuery,
  IssueSortOptions,
  Query,
  QueryCounts,
  TAB_MAX_COUNT,
} from './utils';

type WrapGuideProps = {
  children: React.ReactElement;
  tabQuery: string;
  query: string;
  to: React.ComponentProps<typeof GuideAnchor>['to'];
};

function WrapGuideTabs({children, tabQuery, query, to}: WrapGuideProps) {
  if (isForReviewQuery(tabQuery)) {
    return (
      <GuideAnchor target="inbox_guide_tab" disabled={isForReviewQuery(query)} to={to}>
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
  orgSlug: Organization['slug'];
  router: InjectedRouter;
  projectIds: Array<string>;
  projects: Array<Project>;
  onRealtimeChange: (realtime: boolean) => void;
  displayReprocessingTab: boolean;
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
    if (isForReviewQuery(tabQuery) && !isForReviewQuery(query)) {
      trackAnalyticsEvent({
        eventKey: 'inbox_tab.clicked',
        eventName: 'Clicked Inbox Tab',
        organization_id: organization.id,
      });
    }
  }

  return (
    <React.Fragment>
      <BorderlessHeader>
        <StyledHeaderContent>
          <StyledLayoutTitle>{t('Issues')}</StyledLayoutTitle>
        </StyledHeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <Button
              title={t('Send us feedback via email')}
              size="small"
              href="mailto:workflow-feedback@sentry.io?subject=Issues Feedback"
            >
              Give Feedback
            </Button>
            <Button
              size="small"
              title={t('%s real-time updates', realtimeActive ? t('Pause') : t('Enable'))}
              onClick={() => onRealtimeChange(!realtimeActive)}
            >
              {realtimeActive ? <IconPause size="xs" /> : <IconPlay size="xs" />}
            </Button>
          </ButtonBar>
        </Layout.HeaderActions>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          {visibleTabs.map(
            ([tabQuery, {name: queryName, tooltipTitle, tooltipHoverable}]) => {
              const to = {
                query: {
                  ...queryParms,
                  query: tabQuery,
                  sort: isForReviewQuery(tabQuery) ? IssueSortOptions.INBOX : sortParam,
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
                        {queryCounts[tabQuery] && (
                          <StyledQueryCount
                            isTag
                            tagProps={{
                              type:
                                isForReviewQuery(tabQuery) &&
                                queryCounts[tabQuery].count > 0
                                  ? 'warning'
                                  : 'default',
                            }}
                            count={queryCounts[tabQuery].count}
                            max={queryCounts[tabQuery].hasMore ? TAB_MAX_COUNT : 1000}
                          />
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
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    flex-direction: row;
  }
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

const StyledQueryCount = styled(QueryCount)`
  color: ${p => p.theme.gray300};
`;
