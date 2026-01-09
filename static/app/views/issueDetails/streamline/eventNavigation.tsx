import {Fragment, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import Count from 'sentry/components/count';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {TourElement} from 'sentry/components/tours/components';
import {IconTelescope} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {keepPreviousData} from 'sentry/utils/queryClient';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {IssueDetailsEventNavigation} from 'sentry/views/issueDetails/streamline/issueDetailsEventNavigation';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

interface IssueEventNavigationProps {
  event: Event | undefined;
  group: Group;
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
  const [isSmallNav, setSmallNav] = useState(checkNavIsSmall);

  useResizeObserver({
    ref: navigationRef,
    onResize: () => setSmallNav(checkNavIsSmall),
  });

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

  const attachmentPagination = parseLinkHeader(
    attachments.getResponseHeader?.('Link') ?? null
  );
  // Since we reuse whatever page the user was on, we can look at pagination to determine if there are more attachments
  const hasManyAttachments =
    attachmentPagination.next?.results || attachmentPagination.previous?.results;

  const TabName: Partial<Record<Tab, string>> = {
    [Tab.DETAILS]: issueTypeConfig.customCopy.eventUnits,
    [Tab.EVENTS]: issueTypeConfig.customCopy.eventUnits,
    [Tab.REPLAYS]: t('Replays'),
    [Tab.ATTACHMENTS]: t('Attachments'),
    [Tab.USER_FEEDBACK]: t('Feedback'),
  };

  const isListView = LIST_VIEW_TABS.has(currentTab);

  return (
    <EventNavigationWrapper role="navigation" ref={navigationRef}>
      <Flex align="center" gap="2xs" flexShrink={0}>
        <DropdownMenu
          onAction={key => {
            trackAnalytics('issue_details.issue_content_selected', {
              organization,
              content: TabName[key as keyof typeof TabName]!,
            });
          }}
          items={[
            {
              key: Tab.DETAILS,
              label: (
                <DropdownCountWrapper isCurrentTab={currentTab === Tab.DETAILS}>
                  {TabName[Tab.DETAILS]} <ItemCount value={eventCount ?? 0} />
                </DropdownCountWrapper>
              ),
              textValue: TabName[Tab.DETAILS],
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.DETAILS]}`,
                hash: undefined,
              },
            },
            {
              key: Tab.REPLAYS,
              label: (
                <DropdownCountWrapper isCurrentTab={currentTab === Tab.REPLAYS}>
                  {TabName[Tab.REPLAYS]}{' '}
                  {replaysCount > 50 ? (
                    <CustomItemCount>50+</CustomItemCount>
                  ) : (
                    <ItemCount value={replaysCount} />
                  )}
                </DropdownCountWrapper>
              ),
              textValue: TabName[Tab.REPLAYS],
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.REPLAYS]}`,
                hash: undefined,
              },
              hidden: !issueTypeConfig.pages.replays.enabled,
            },
            {
              key: Tab.ATTACHMENTS,
              label: (
                <DropdownCountWrapper isCurrentTab={currentTab === Tab.ATTACHMENTS}>
                  {TabName[Tab.ATTACHMENTS]}
                  <CustomItemCount>
                    {hasManyAttachments ? '50+' : attachments.attachments.length}
                  </CustomItemCount>
                </DropdownCountWrapper>
              ),
              textValue: TabName[Tab.ATTACHMENTS],
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.ATTACHMENTS]}`,
                hash: undefined,
              },
              hidden: !issueTypeConfig.pages.attachments.enabled,
            },
            {
              key: Tab.USER_FEEDBACK,
              label: (
                <DropdownCountWrapper isCurrentTab={currentTab === Tab.USER_FEEDBACK}>
                  {TabName[Tab.USER_FEEDBACK]} <ItemCount value={group.userReportCount} />
                </DropdownCountWrapper>
              ),
              textValue: TabName[Tab.USER_FEEDBACK],
              to: {
                ...location,
                pathname: `${baseUrl}${TabPaths[Tab.USER_FEEDBACK]}`,
                hash: undefined,
              },
              hidden: !issueTypeConfig.pages.userFeedback.enabled,
            },
          ]}
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
                borderless
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
      <TourElement<IssueDetailsTour>
        tourContext={IssueDetailsTourContext}
        id={IssueDetailsTour.NAVIGATION}
        title={t('Compare different examples')}
        description={t(
          'You can quickly navigate between different examples in this issue to find their similarities (and differences).'
        )}
      >
        <NavigationWrapper>
          {currentTab === Tab.DETAILS && (
            <Fragment>
              <IssueDetailsEventNavigation
                event={event}
                group={group}
                isSmallNav={isSmallNav}
              />
              {issueTypeConfig.pages.events.enabled && (
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
              )}
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
                  {isSmallNav ? t('More Uptime Checks') : t('View More Uptime Checks')}
                </LinkButton>
              )}
            </Fragment>
          )}
          {isListView && (
            <ButtonBar>
              {issueTypeConfig.discover.enabled && currentTab === Tab.EVENTS && (
                <LinkButton
                  to={{
                    pathname: discoverUrl.pathname,
                    query: {
                      ...discoverUrl.query,
                      sort: location.query.sort ?? '-timestamp',
                    },
                  }}
                  aria-label={t('Open in Discover')}
                  size="xs"
                  icon={<IconTelescope />}
                  analyticsEventKey="issue_details.discover_clicked"
                  analyticsEventName="Issue Details: Discover Clicked"
                >
                  {t('Open in Discover')}
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
            </ButtonBar>
          )}
        </NavigationWrapper>
      </TourElement>
    </EventNavigationWrapper>
  );
}

const NavigationDropdownButton = styled(DropdownButton)`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  padding-right: ${space(0.5)};
`;

const NavigationLabel = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  padding-right: ${space(0.25)};
  padding-left: ${space(1.5)};
`;

const LargeInThisIssueText = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.tokens.content.secondary};
  line-height: 1;
`;

const EventNavigationWrapper = styled('div')`
  flex-grow: 1;
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSize.sm};

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    flex-direction: row;
    align-items: center;
  }
`;

const NavigationWrapper = styled('div')`
  display: flex;
  gap: ${space(0.25)};
  justify-content: space-between;

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    gap: ${space(0.5)};
  }
`;

const DropdownCountWrapper = styled('div')<{isCurrentTab: boolean}>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(3)};
  font-variant-numeric: tabular-nums;
  font-weight: ${p =>
    p.isCurrentTab ? p.theme.fontWeight.bold : p.theme.fontWeight.normal};
`;

const ItemCount = styled(Count)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const CustomItemCount = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
