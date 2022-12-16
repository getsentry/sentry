import {ReactNode} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import Badge from 'sentry/components/badge';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import QueryCount from 'sentry/components/queryCount';
import {Item, TabList, Tabs} from 'sentry/components/tabs';
import Tooltip from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconPause, IconPlay, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SavedSearch} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useProjects from 'sentry/utils/useProjects';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import IssueListSetAsDefault from 'sentry/views/issueList/issueListSetAsDefault';

import {
  getTabs,
  IssueSortOptions,
  Query,
  QueryCounts,
  SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
  TAB_MAX_COUNT,
} from './utils';

type IssueListHeaderProps = {
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
};

type IssueListHeaderTabProps = {
  name: string;
  query: string;
  count?: number;
  hasMore?: boolean;
  tooltipHoverable?: boolean;
  tooltipTitle?: ReactNode;
};

const EXTRA_TAB_KEY = 'extra-tab-key';

function IssueListHeaderTabContent({
  count = 0,
  hasMore = false,
  name,
  query,
  tooltipHoverable,
  tooltipTitle,
}: IssueListHeaderTabProps) {
  return (
    <Tooltip
      title={tooltipTitle}
      position="bottom"
      isHoverable={tooltipHoverable}
      delay={SLOW_TOOLTIP_DELAY}
    >
      {name}{' '}
      {count > 0 && (
        <Badge type={query === Query.FOR_REVIEW && count > 0 ? 'review' : 'default'}>
          <QueryCount hideParens count={count} max={hasMore ? TAB_MAX_COUNT : 1000} />
        </Badge>
      )}
    </Tooltip>
  );
}

function IssueListHeader({
  organization,
  query,
  sort,
  queryCount,
  queryCounts,
  realtimeActive,
  onRealtimeChange,
  savedSearch,
  router,
  displayReprocessingTab,
  selectedProjectIds,
}: IssueListHeaderProps) {
  const [isSavedSearchesOpen, setIsSavedSearchesOpen] = useSyncedLocalStorageState(
    SAVED_SEARCHES_SIDEBAR_OPEN_LOCALSTORAGE_KEY,
    false
  );
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

  function onSavedSearchesToggleClicked() {
    const newOpenState = !isSavedSearchesOpen;
    trackAdvancedAnalyticsEvent('search.saved_search_sidebar_toggle_clicked', {
      organization,
      open: newOpenState,
    });
    setIsSavedSearchesOpen(newOpenState);
  }

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
    <Layout.Header>
      <Layout.HeaderContent>
        <StyledLayoutTitle>
          {t('Issues')}
          <PageHeadingQuestionTooltip
            title={tct(
              'Detailed views of errors and performance problems in your application grouped by events with a similar set of characteristics. [link: Read the docs].',
              {link: <ExternalLink href="https://docs.sentry.io/product/issues/" />}
            )}
          />
        </StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <IssueListSetAsDefault {...{sort, query, organization}} />
          <Button
            size="sm"
            icon={<IconStar size="sm" isSolid={isSavedSearchesOpen} />}
            onClick={onSavedSearchesToggleClicked}
          >
            {isSavedSearchesOpen ? t('Hide Searches') : t('Saved Searches')}
          </Button>
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
      <StyledTabs
        onSelectionChange={key =>
          trackTabClick(key === EXTRA_TAB_KEY ? query : key.toString())
        }
        selectedKey={savedSearchTabActive ? EXTRA_TAB_KEY : query}
      >
        <TabList hideBorder>
          {[
            ...visibleTabs.map(
              ([tabQuery, {name: queryName, tooltipTitle, tooltipHoverable}]) => {
                const to = normalizeUrl({
                  query: {
                    ...queryParms,
                    query: tabQuery,
                    sort:
                      tabQuery === Query.FOR_REVIEW ? IssueSortOptions.INBOX : sortParam,
                  },
                  pathname: `/organizations/${organization.slug}/issues/`,
                });

                return (
                  <Item key={tabQuery} to={to} textValue={queryName}>
                    <IssueListHeaderTabContent
                      tooltipTitle={tooltipTitle}
                      tooltipHoverable={tooltipHoverable}
                      name={queryName}
                      count={queryCounts[tabQuery]?.count}
                      hasMore={queryCounts[tabQuery]?.hasMore}
                      query={tabQuery}
                    />
                  </Item>
                );
              }
            ),
            <Item
              hidden={!savedSearchTabActive}
              key={EXTRA_TAB_KEY}
              to={{query: queryParms, pathname: location.pathname}}
              textValue={savedSearch?.name ?? t('Custom Search')}
            >
              <IssueListHeaderTabContent
                name={savedSearch?.name ?? t('Custom Search')}
                count={queryCount}
                query={query}
              />
            </Item>,
          ]}
        </TabList>
      </StyledTabs>
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

const StyledTabs = styled(Tabs)`
  grid-column: 1/-1;
`;
