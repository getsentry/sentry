import {Fragment, useCallback, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';
import {keepPreviousData} from '@tanstack/react-query';

import {Badge} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {DropdownButton, DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Flex, Grid} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import Feature from 'sentry/components/acl/feature';
import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {Count} from 'sentry/components/count';
import {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerPanelActions} from 'sentry/components/events/autofix/v3/seerPanelActions';
import {TourElement} from 'sentry/components/tours/components';
import {IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useReplayCountForIssues} from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
import {useAutofixPanel} from 'sentry/views/issueDetails/autofix/context';
import {hasAutofixPage} from 'sentry/views/issueDetails/autofix/utils';
import {useIssueDetails} from 'sentry/views/issueDetails/context';
import {IssueDetailsEventNavigation} from 'sentry/views/issueDetails/eventNavigation/issueDetailsEventNavigation';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {
  issueAndEventToMarkdown,
  useActiveThreadId,
} from 'sentry/views/issueDetails/hooks/useCopyIssueDetails';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/hooks/useIssueDetailsDiscoverQuery';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface IssueEventNavigationProps {
  event: Event | undefined;
  group: Group;
}

interface ContentTab {
  /**
   * The bare count, unstyled: tabs put it in a Badge, the dropdown right-aligns
   * it in muted text. Null when the tab has nothing to count.
   */
  count: React.ReactNode;
  hidden: boolean;
  key: Tab;
  name: string;
}

const LIST_VIEW_TABS = new Set([
  Tab.EVENTS,
  Tab.OPEN_PERIODS,
  Tab.CHECK_INS,
  Tab.UPTIME_CHECKS,
]);

export function IssueEventNavigation({event, group}: IssueEventNavigationProps) {
  const organization = useOrganization();
  const {baseUrl, currentTab} = useGroupDetailsRoute();
  const location = useLocation();
  const eventView = useIssueDetailsEventView({group});
  const {eventCount} = useIssueDetails();
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const theme = useTheme();

  function checkNavIsSmall() {
    const navEl = navigationRef.current;
    return !!navEl && navEl.clientWidth < parseInt(theme.breakpoints.sm, 10);
  }

  const navigationRef = useRef<HTMLDivElement>(null);
  // oxlint-disable-next-line react/refs
  const [isSmallNav, setSmallNav] = useState(checkNavIsSmall);

  useResizeObserver({
    ref: navigationRef,
    onResize: () => setSmallNav(checkNavIsSmall),
  });

  // `autofix-page` rolls out with Seer, so the orgs that hide AI keep the
  // dropdown rather than getting the tab list ahead of everyone else. The same
  // conditions decide whether Autofix is one of the tabs, because the tab and
  // the page behind it arrive together.
  const showContentTabs =
    hasAutofixPage(organization) &&
    organization.features.includes('gen-ai-features') &&
    !organization.hideAiFeatures;

  // Only consulted on the dropdown path, which tabs replace outright.
  const hideDropdownButton =
    !issueTypeConfig.pages.attachments.enabled &&
    !issueTypeConfig.pages.userFeedback.enabled &&
    !issueTypeConfig.pages.replays.enabled;

  const discoverUrl = eventView.getResultsViewUrlTarget(
    organization,
    false,
    hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
  );

  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  const attachments = useGroupEventAttachments({
    group,
    activeAttachmentsTab: 'all',
    options: {placeholderData: keepPreviousData},
  });

  const attachmentPagination = parseLinkHeader(attachments.pageLinks);
  // Since we reuse whatever page the user was on, we can look at pagination to determine if there are more attachments
  const hasManyAttachments =
    attachmentPagination.next?.results || attachmentPagination.previous?.results;

  const TabName: Partial<Record<Tab, string>> = {
    [Tab.DETAILS]: issueTypeConfig.customCopy.eventUnits,
    [Tab.EVENTS]: issueTypeConfig.customCopy.eventUnits,
    [Tab.REPLAYS]: t('Replays'),
    [Tab.ATTACHMENTS]: t('Attachments'),
    [Tab.USER_FEEDBACK]: t('Feedback'),
    [Tab.AUTOFIX]: t('Autofix'),
  };

  const contentTabs: ContentTab[] = [
    {
      key: Tab.DETAILS,
      name: TabName[Tab.DETAILS]!,
      count: <Count value={eventCount ?? 0} />,
      hidden: false,
    },
    {
      key: Tab.AUTOFIX,
      name: TabName[Tab.AUTOFIX]!,
      // Autofix has no count to show; it is a single ongoing analysis.
      count: null,
      hidden: !showContentTabs,
    },
    {
      key: Tab.REPLAYS,
      name: TabName[Tab.REPLAYS]!,
      count: replaysCount > 50 ? '50+' : <Count value={replaysCount} />,
      hidden: !issueTypeConfig.pages.replays.enabled,
    },
    {
      key: Tab.ATTACHMENTS,
      name: TabName[Tab.ATTACHMENTS]!,
      count: hasManyAttachments ? '50+' : attachments.attachments.length,
      hidden: !issueTypeConfig.pages.attachments.enabled,
    },
    {
      key: Tab.USER_FEEDBACK,
      name: TabName[Tab.USER_FEEDBACK]!,
      count: <Count value={group.userReportCount} />,
      hidden: !issueTypeConfig.pages.userFeedback.enabled,
    },
  ];

  const trackContentSelected = (key: Tab) => {
    trackAnalytics('issue_details.issue_content_selected', {
      organization,
      content: TabName[key]!,
    });
  };

  const contentLocation = (key: Tab) => ({
    ...location,
    pathname: `${baseUrl}${TabPaths[key]}`,
    hash: undefined,
  });

  const isListView = LIST_VIEW_TABS.has(currentTab);

  const activeThreadId = useActiveThreadId();
  const autofixPanel = useAutofixPanel();

  // Get data for markdown copy functionality
  const {runState: autofixData, autofixFormatted} = useExplorerAutofix(group, {
    enabled: false,
  });

  const handleCopyMarkdown = useCallback(() => {
    const markdownText = issueAndEventToMarkdown({
      group,
      event,
      autofixData,
      activeThreadId,
      organization,
      autofixFormatted,
    });

    trackAnalytics('issue_details.copy_issue_details_as_markdown', {
      organization,
      groupId: group.id,
      eventId: event?.id,
      hasAutofix: Boolean(autofixData),
    });

    return markdownText;
  }, [activeThreadId, event, group, autofixData, organization, autofixFormatted]);

  return (
    <EventNavigationWrapper role="navigation" ref={navigationRef}>
      {showContentTabs ? (
        <Tabs value={currentTab} onChange={key => trackContentSelected(key as Tab)}>
          <TabList>
            {contentTabs.map(tab => (
              <TabList.Item
                key={tab.key}
                hidden={tab.hidden}
                to={contentLocation(tab.key)}
                textValue={tab.name}
              >
                <TabLabel>
                  {tab.name}
                  {tab.count === null ? null : <Badge variant="muted">{tab.count}</Badge>}
                </TabLabel>
              </TabList.Item>
            ))}
          </TabList>
        </Tabs>
      ) : (
        <Flex align="center" gap="2xs" flexShrink={0}>
          <DropdownMenu
            usePortal
            zIndex={theme.zIndex.stickyHeader + 1}
            onAction={key => trackContentSelected(key as Tab)}
            items={contentTabs.map(tab => ({
              key: tab.key,
              label: (
                <DropdownCountWrapper isCurrentTab={currentTab === tab.key}>
                  {tab.name} <MutedCount>{tab.count}</MutedCount>
                </DropdownCountWrapper>
              ),
              textValue: tab.name,
              to: contentLocation(tab.key),
              hidden: tab.hidden,
            }))}
            offset={[-2, 1]}
            trigger={(triggerProps, isOpen) =>
              hideDropdownButton ? (
                <NavigationLabel>
                  {TabName[currentTab] ?? TabName[Tab.DETAILS]}
                </NavigationLabel>
              ) : (
                <NavigationDropdownButton
                  {...triggerProps}
                  isOpen={isOpen}
                  variant="transparent"
                  size="sm"
                  disabled={hideDropdownButton}
                  aria-label={t('Select issue content')}
                  aria-description={TabName[currentTab]}
                  analyticsEventName="Issue Details: Issue Content Dropdown Opened"
                  analyticsEventKey="issue_details.issue_content_dropdown_opened"
                >
                  {TabName[currentTab] ?? TabName[Tab.DETAILS]}
                </NavigationDropdownButton>
              )
            }
          />
          <LargeInThisIssueText aria-hidden>{t('in this issue')}</LargeInThisIssueText>
        </Flex>
      )}
      <TourElement<IssueDetailsTour>
        tourContext={IssueDetailsTourContext}
        id={IssueDetailsTour.NAVIGATION}
        title={t('Compare and copy events')}
        description={t(
          'Review the events associated with an issue. Compare the first, latest, or recommended event to see what changed, or use Copy as to copy the issue details as Markdown.'
        )}
      >
        {tourProps => (
          <div {...tourProps}>
            <NavigationWrapper>
              {currentTab === Tab.AUTOFIX && autofixPanel && (
                <SeerPanelActions
                  autofixState={autofixPanel.runState}
                  enableBashTools={autofixPanel.enableBashTools}
                  onCopyMarkdown={autofixPanel.handleCopyMarkdown}
                  onEnableBashToolsChange={autofixPanel.setEnableBashTools}
                  onOpenSeerAgent={autofixPanel.handleOpenSeerAgent}
                  onReset={autofixPanel.handleRestart}
                />
              )}
              {currentTab === Tab.DETAILS && (
                <Fragment>
                  <IssueDetailsEventNavigation
                    event={event}
                    group={group}
                    isSmallNav={isSmallNav}
                  />
                  {issueTypeConfig.pages.events.enabled && (
                    <Feature features="discover-basic" organization={organization}>
                      <LinkButton
                        to={{
                          pathname: `${baseUrl}${TabPaths[Tab.EVENTS]}`,
                          query: location.query,
                        }}
                        size="xs"
                        analyticsEventKey="issue_details.all_events_clicked"
                        analyticsEventName="Issue Details: All Events Clicked"
                      >
                        {isSmallNav
                          ? t('More %s', issueTypeConfig.customCopy.eventUnits)
                          : t('View More %s', issueTypeConfig.customCopy.eventUnits)}
                      </LinkButton>
                    </Feature>
                  )}
                  <CopyAsDropdown
                    usePortal
                    size="xs"
                    zIndex={theme.zIndex.stickyHeader + 1}
                    items={CopyAsDropdown.makeDefaultCopyAsOptions({
                      text: undefined,
                      json: undefined,
                      markdown: handleCopyMarkdown,
                    })}
                  />
                  {issueTypeConfig.pages.openPeriods.enabled && (
                    <LinkButton
                      to={{
                        pathname: `${baseUrl}${TabPaths[Tab.OPEN_PERIODS]}`,
                        query: location.query,
                      }}
                      size="xs"
                      analyticsEventKey="issue_details.all_open_periods_clicked"
                      analyticsEventName="Issue Details: All Open Periods Clicked"
                    >
                      {isSmallNav ? t('More Open Periods') : t('View More Open Periods')}
                    </LinkButton>
                  )}
                  {issueTypeConfig.pages.checkIns.enabled && (
                    <LinkButton
                      to={{
                        pathname: `${baseUrl}${TabPaths[Tab.CHECK_INS]}`,
                        query: location.query,
                      }}
                      size="xs"
                      analyticsEventKey="issue_details.all_checks_ins_clicked"
                      analyticsEventName="Issue Details: All Checks-Ins Clicked"
                    >
                      {isSmallNav ? t('More Check-Ins') : t('View More Check-Ins')}
                    </LinkButton>
                  )}
                  {issueTypeConfig.pages.uptimeChecks.enabled && (
                    <LinkButton
                      to={{
                        pathname: `${baseUrl}${TabPaths[Tab.UPTIME_CHECKS]}`,
                        query: location.query,
                      }}
                      size="xs"
                      analyticsEventKey="issue_details.all_uptime_checks_clicked"
                      analyticsEventName="Issue Details: All Uptime Checks Clicked"
                    >
                      {isSmallNav
                        ? t('More Uptime Checks')
                        : t('View More Uptime Checks')}
                    </LinkButton>
                  )}
                </Fragment>
              )}
              {isListView && (
                <Grid flow="column" align="center" gap="md">
                  {issueTypeConfig.discover.enabled && currentTab === Tab.EVENTS && (
                    <LinkButton
                      to={{
                        pathname: discoverUrl.pathname,
                        query: {
                          ...discoverUrl.query,
                          sort: location.query.sort ?? '-timestamp',
                        },
                      }}
                      aria-label={
                        getDiscoverDeprecation(organization)
                          ? t('Open in Explore')
                          : t('Open in Discover')
                      }
                      size="xs"
                      icon={<IconTelescope />}
                      analyticsEventKey="issue_details.discover_clicked"
                      analyticsEventName="Issue Details: Discover Clicked"
                    >
                      {getDiscoverDeprecation(organization)
                        ? t('Open in Explore')
                        : t('Open in Discover')}
                    </LinkButton>
                  )}
                  <LinkButton
                    to={{
                      pathname: `${baseUrl}${TabPaths[Tab.DETAILS]}`,
                      query: {...location.query, cursor: undefined},
                    }}
                    aria-label={t('Return to event details')}
                    size="xs"
                  >
                    {t('Close')}
                  </LinkButton>
                </Grid>
              )}
            </NavigationWrapper>
          </div>
        )}
      </TourElement>
    </EventNavigationWrapper>
  );
}

const NavigationDropdownButton = styled(DropdownButton)`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  padding-right: ${p => p.theme.space.xs};
`;

const NavigationLabel = styled('div')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  padding-right: ${p => p.theme.space['2xs']};
  padding-left: ${p => p.theme.space.lg};
`;

const LargeInThisIssueText = styled('div')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1;
`;

const EventNavigationWrapper = styled('div')`
  flex-grow: 1;
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  justify-content: space-between;
  font-size: ${p => p.theme.font.size.sm};

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    flex-direction: row;
    align-items: center;
  }
`;

const NavigationWrapper = styled('div')`
  display: flex;
  gap: ${p => p.theme.space['2xs']};
  justify-content: space-between;

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    gap: ${p => p.theme.space.xs};
  }
`;

const TabLabel = styled('span')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-variant-numeric: tabular-nums;
`;

const DropdownCountWrapper = styled('div')<{isCurrentTab: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space['2xl']};
  font-variant-numeric: tabular-nums;
  font-weight: ${p =>
    p.isCurrentTab ? p.theme.font.weight.sans.medium : p.theme.font.weight.sans.regular};
`;

const MutedCount = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
