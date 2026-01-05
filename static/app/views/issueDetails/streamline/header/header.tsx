import {Fragment} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Tag} from 'sentry/components/core/badge/tag';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventMessage from 'sentry/components/events/eventMessage';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {useFeedbackSDKIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import {TourElement} from 'sentry/components/tours/components';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueType} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getMessage, getTitle} from 'sentry/utils/events';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {GroupActions} from 'sentry/views/issueDetails/actions/index';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';
import {Divider} from 'sentry/views/issueDetails/divider';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {
  IssueDetailsTour,
  IssueDetailsTourContext,
} from 'sentry/views/issueDetails/issueDetailsTour';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/streamline/header/assigneeSelector';
import {AttachmentsBadge} from 'sentry/views/issueDetails/streamline/header/attachmentsBadge';
import {IssueIdBreadcrumb} from 'sentry/views/issueDetails/streamline/header/issueIdBreadcrumb';
import {ReplayBadge} from 'sentry/views/issueDetails/streamline/header/replayBadge';
import SeerBadge from 'sentry/views/issueDetails/streamline/header/seerBadge';
import {UserFeedbackBadge} from 'sentry/views/issueDetails/streamline/header/userFeedbackBadge';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';

interface GroupHeaderProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export default function StreamlinedGroupHeader({
  event,
  group,
  project,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {baseUrl} = useGroupDetailsRoute();

  const {sort: _sort, ...query} = location.query;
  const {count: eventCount, userCount} = group;
  const useGetMaxRetentionDays =
    HookStore.get('react-hook:use-get-max-retention-days')[0] ??
    (() => MAX_PICKABLE_DAYS);
  const maxRetentionDays = useGetMaxRetentionDays();
  const userCountPeriod = maxRetentionDays ? `(${maxRetentionDays}d)` : '(30d)';
  const {title: primaryTitle, subtitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const isComplete = group.status === 'resolved' || group.status === 'ignored';
  const groupReprocessingStatus = getGroupReprocessingStatus(group);
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(groupReprocessingStatus);

  const hasErrorUpsampling = project.features.includes('error-upsampling');

  const hasFeedbackForm =
    group.issueType === IssueType.QUERY_INJECTION_VULNERABILITY ||
    group.issueType === IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS;
  const feedbackSource =
    group.issueType === IssueType.QUERY_INJECTION_VULNERABILITY
      ? 'issue_details_query_injection'
      : 'issue_details_n_plus_one_api_calls';
  const {feedback} = useFeedbackSDKIntegration();

  const statusProps = getBadgeProperties(group.status, group.substatus);
  const issueTypeConfig = getConfigForIssueType(group, project);

  const hasOnlyOneUIOption = defined(organization.streamlineOnly);
  const [showLearnMore, setShowLearnMore] = useLocalStorageState(
    'issue-details-learn-more',
    true
  );

  return (
    <Fragment>
      <Header>
        <Flex justify="between">
          <Flex align="center" gap="md">
            <StyledBreadcrumbs
              crumbs={[
                {
                  label: 'Issues',
                  to: {
                    pathname: `/organizations/${organization.slug}/issues/`,
                    query,
                  },
                },
                {
                  label: <IssueIdBreadcrumb project={project} group={group} />,
                },
              ]}
            />
            {hasErrorUpsampling && (
              <Tooltip
                title={t(
                  'Error counts on this page have been upsampled based on your sampling rate.'
                )}
              >
                <StyledTag variant="muted">{t('Errors Upsampled')}</StyledTag>
              </Tooltip>
            )}
          </Flex>
          <ButtonBar gap="xs">
            {!hasOnlyOneUIOption && !hasFeedbackForm && (
              <LinkButton
                size="xs"
                external
                title={t('Learn more about the new UI')}
                href="https://docs.sentry.io/product/issues/issue-details/"
                aria-label={t('Learn more about the new UI')}
                icon={<IconInfo />}
                analyticsEventKey="issue_details.streamline_ui_learn_more"
                analyticsEventName="Issue Details: Streamline UI Learn More"
                analyticsParams={{show_learn_more: showLearnMore}}
                onClick={() => setShowLearnMore(false)}
              >
                {showLearnMore ? t("See What's New") : null}
              </LinkButton>
            )}
            {hasFeedbackForm && feedback ? (
              <FeedbackButton
                aria-label={t('Give feedback on the issue Sentry detected')}
                size="xs"
                feedbackOptions={{
                  messagePlaceholder: t(
                    'Please provide feedback on the issue Sentry detected.'
                  ),
                  tags: {
                    ['feedback.source']: feedbackSource,
                  },
                }}
              />
            ) : (
              <NewIssueExperienceButton />
            )}
          </ButtonBar>
        </Flex>
        <HeaderGrid>
          <Title>
            <Tooltip
              title={primaryTitle}
              skipWrapper
              isHoverable
              showOnlyOnOverflow
              delay={1000}
            >
              <PrimaryTitle>{primaryTitle}</PrimaryTitle>
            </Tooltip>
          </Title>
          <StatTitle>
            {issueTypeConfig.eventAndUserCounts.enabled && (
              <StatLink
                to={`${baseUrl}events/${location.search}`}
                aria-label={t('View events')}
              >
                {t('Events (total)')}
              </StatLink>
            )}
          </StatTitle>
          <StatTitle>
            {issueTypeConfig.eventAndUserCounts.enabled &&
              (userCount === 0 ? (
                t('Users %s', userCountPeriod)
              ) : (
                <StatLink
                  to={`${baseUrl}${TabPaths[Tab.DISTRIBUTIONS]}user/${location.search}`}
                  aria-label={t('View affected users')}
                >
                  {t('Users %s', userCountPeriod)}
                </StatLink>
              ))}
          </StatTitle>
          <EventMessage
            data={group}
            level={group.level}
            message={secondaryTitle}
            type={group.type}
          />
          {issueTypeConfig.eventAndUserCounts.enabled && (
            <Fragment>
              <StatCount value={eventCount} aria-label={t('Event count')} />
              <StatCount value={userCount} aria-label={t('User count')} />
            </Fragment>
          )}
          <Flex gap="md" align="center">
            {group.isUnhandled && (
              <Fragment>
                <UnhandledTag />
                <Divider />
              </Fragment>
            )}
            {statusProps?.status ? (
              <Fragment>
                <Tooltip
                  isHoverable
                  title={tct('[tooltip] [link:Learn more]', {
                    tooltip: statusProps.tooltip,
                    link: (
                      <ExternalLink href="https://docs.sentry.io/product/issues/states-triage/" />
                    ),
                  })}
                >
                  <Subtext>{statusProps?.status}</Subtext>
                </Tooltip>
              </Fragment>
            ) : null}
            {subtitle && (
              <Fragment>
                <Divider />
                <Tooltip
                  title={subtitle}
                  skipWrapper
                  isHoverable
                  showOnlyOnOverflow
                  delay={1000}
                >
                  <Subtext>{subtitle}</Subtext>
                </Tooltip>
              </Fragment>
            )}
            <ErrorBoundary customComponent={null}>
              <AttachmentsBadge group={group} />
              <UserFeedbackBadge group={group} project={project} />
              <ReplayBadge group={group} project={project} />
              <SeerBadge group={group} />
            </ErrorBoundary>
          </Flex>
        </HeaderGrid>
      </Header>
      <TourElement<IssueDetailsTour>
        tourContext={IssueDetailsTourContext}
        id={IssueDetailsTour.WORKFLOWS}
        title={t('Take action')}
        description={t(
          'Now that you’ve learned about this issue, it’s time to assign an owner, update priority, and take additional actions.'
        )}
        position="bottom-end"
      >
        <ActionBar isComplete={isComplete} role="banner">
          <GroupActions
            group={group}
            project={project}
            disabled={disableActions}
            event={event}
          />
          <WorkflowActions>
            <Workflow>
              {t('Priority')}
              <GroupPriority group={group} />
            </Workflow>
            <Workflow>
              {t('Assignee')}
              <GroupHeaderAssigneeSelector
                group={group}
                project={project}
                event={event}
              />
            </Workflow>
          </WorkflowActions>
        </ActionBar>
      </TourElement>
    </Fragment>
  );
}

const Header = styled('header')`
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']};
`;

const HeaderGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto auto;
  column-gap: ${space(2)};
  align-items: center;
`;

const PrimaryTitle = styled('span')`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: ${p => p.theme.fontWeight.bold};
  flex-shrink: 0;
`;

const StatTitle = styled('div')`
  display: block;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1;
  justify-self: flex-end;
`;

const StatLink = styled(Link)`
  color: ${p => p.theme.subText};
  text-decoration: ${p => (p['aria-disabled'] ? 'none' : 'underline')};
  text-decoration-style: dotted;
`;

const StatCount = styled(Count)`
  display: block;
  font-size: 20px;
  line-height: 1;
  text-align: right;
`;

const Subtext = styled('span')`
  color: ${p => p.theme.subText};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ActionBar = styled('div')<{isComplete: boolean}>`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
  flex-wrap: wrap;
  padding: ${space(1)} 24px;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
  transition: background 0.3s ease-in-out;
  background: ${p => (p.isComplete ? 'transparent' : p.theme.tokens.background.primary)};
  &:before {
    z-index: -1;
    position: absolute;
    inset: 0;
    content: '';
    background: linear-gradient(
      to right,
      ${p => p.theme.tokens.background.primary},
      ${p => Color(p.theme.success).lighten(0.5).alpha(0.15).string()}
    );
  }
  &:after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    left: 24px;
    bottom: unset;
    height: 1px;
    background: ${p => p.theme.tokens.border.primary};
  }
`;

const WorkflowActions = styled('div')`
  display: flex;
  justify-content: flex-end;
  column-gap: ${space(2)};
  flex-wrap: wrap;
  @media (max-width: ${p => p.theme.breakpoints.lg}) {
    justify-content: flex-start;
  }
`;

const Workflow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
`;

const Title = styled('div')`
  display: grid;
  grid-template-columns: minmax(0, max-content);
  align-items: center;
  column-gap: ${p => p.theme.space.sm};
`;

const StyledBreadcrumbs = styled(Breadcrumbs)`
  padding: 0;
`;

const StyledTag = styled(Tag)`
  @media (max-width: ${p => p.theme.breakpoints.xs}) {
    display: none;
  }
`;
