import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Count from 'sentry/components/count';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {IssueDetailsEventNavigation} from 'sentry/views/issueDetails/streamline/issueDetailsEventNavigation';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

const TabName = {
  [Tab.DETAILS]: t('Events'),
  [Tab.EVENTS]: t('Events'),
  [Tab.REPLAYS]: t('Replays'),
  [Tab.ATTACHMENTS]: t('Attachments'),
  [Tab.USER_FEEDBACK]: t('Feedback'),
};

interface IssueEventNavigationProps {
  event: Event | undefined;
  group: Group;
}

export function IssueEventNavigation({event, group}: IssueEventNavigationProps) {
  const organization = useOrganization();
  const {baseUrl, currentTab} = useGroupDetailsRoute();
  const location = useLocation();
  const eventView = useIssueDetailsEventView({group});
  const {eventCount} = useIssueDetails();
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const hideDropdownButton =
    !issueTypeConfig.attachments.enabled &&
    !issueTypeConfig.userFeedback.enabled &&
    !issueTypeConfig.replays.enabled;

  const discoverUrl = eventView.getResultsViewUrlTarget(
    organization.slug,
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

  return (
    <EventNavigationWrapper role="navigation">
      <LargeDropdownButtonWrapper>
        <DropdownMenu
          onAction={key => {
            trackAnalytics('issue_details.issue_content_selected', {
              organization,
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              content: TabName[key],
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
              },
              hidden: !issueTypeConfig.replays.enabled,
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
              },
              hidden: !issueTypeConfig.attachments.enabled,
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
              },
              hidden: !issueTypeConfig.userFeedback.enabled,
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
      </LargeDropdownButtonWrapper>
      <NavigationWrapper>
        {currentTab === Tab.DETAILS && (
          <Fragment>
            <IssueDetailsEventNavigation event={event} group={group} />
            <LinkButton
              to={{
                pathname: `${baseUrl}${TabPaths[Tab.EVENTS]}`,
                query: location.query,
              }}
              size="xs"
              analyticsEventKey="issue_details.all_events_clicked"
              analyticsEventName="Issue Details: All Events Clicked"
            >
              {issueTypeConfig.customCopy.allEvents || t('All Events')}
            </LinkButton>
          </Fragment>
        )}

        {currentTab === Tab.EVENTS && (
          <ButtonBar gap={1}>
            <LinkButton
              to={discoverUrl}
              aria-label={t('Open in Discover')}
              size="xs"
              icon={<IconTelescope />}
              analyticsEventKey="issue_details.discover_clicked"
              analyticsEventName="Issue Details: Discover Clicked"
            >
              {t('Discover')}
            </LinkButton>
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
    </EventNavigationWrapper>
  );
}

const LargeDropdownButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const NavigationDropdownButton = styled(DropdownButton)`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  padding-right: ${space(0.5)};
`;

const NavigationLabel = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  padding-right: ${space(0.25)};
  padding-left: ${space(1.5)};
`;

const LargeInThisIssueText = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const EventNavigationWrapper = styled('div')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    flex-direction: row;
    align-items: center;
  }
`;

const NavigationWrapper = styled('div')`
  display: flex;
  gap: ${space(0.25)};
  justify-content: space-between;

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
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
    p.isCurrentTab ? p.theme.fontWeightBold : p.theme.fontWeightNormal};
`;

const ItemCount = styled(Count)`
  color: ${p => p.theme.subText};
`;

const CustomItemCount = styled('div')`
  color: ${p => p.theme.subText};
`;
