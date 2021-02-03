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
import {getTabs, isForReviewQuery, Query, QueryCounts, TAB_MAX_COUNT} from './utils';

type Props = {
  organization: Organization;
  query: string;
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
              title={t(
                'You’re seeing the new issues experience because you’ve opted to be an early adopter of new features. Send us feedback via email'
              )}
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
              const inboxGuideStepOne = queryName === 'For Review' && query !== tabQuery;
              const inboxGuideStepTwo = queryName === 'For Review' && query === tabQuery;
              const to = {
                query: {
                  ...queryParms,
                  query: tabQuery,
                  sort:
                    queryParms.sort === 'inbox' && !isForReviewQuery(tabQuery)
                      ? undefined
                      : queryParms.sort,
                },
                pathname: `/organizations/${organization.slug}/issues/`,
              };

              return (
                <li key={tabQuery} className={query === tabQuery ? 'active' : ''}>
                  <Link to={to} onClick={() => trackTabClick(tabQuery)}>
                    <GuideAnchor
                      target={inboxGuideStepOne ? 'inbox_guide_tab' : 'none'}
                      disabled={!inboxGuideStepOne}
                      to={to}
                    >
                      <GuideAnchor
                        target={inboxGuideStepTwo ? 'for_review_guide_tab' : 'none'}
                        disabled={!inboxGuideStepTwo}
                      >
                        <Tooltip
                          title={tooltipTitle}
                          position="bottom"
                          isHoverable={tooltipHoverable}
                        >
                          {queryName}{' '}
                          {queryCounts[tabQuery] && (
                            <StyledQueryCount
                              isTag
                              count={queryCounts[tabQuery].count}
                              max={queryCounts[tabQuery].hasMore ? TAB_MAX_COUNT : 1000}
                            />
                          )}
                        </Tooltip>
                      </GuideAnchor>
                    </GuideAnchor>
                  </Link>
                </li>
              );
            }
          )}
          <SavedSearchTab
            organization={organization}
            query={query}
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
