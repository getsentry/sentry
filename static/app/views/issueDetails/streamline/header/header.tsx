import {Fragment} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventMessage from 'sentry/components/events/eventMessage';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {TourElement} from 'sentry/components/tours/components';
import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import {IconInfo, IconMegaphone} from 'sentry/icons';
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
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
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

  const isQueryInjection = group.issueType === IssueType.DB_QUERY_INJECTION_VULNERABILITY;
  const openForm = useFeedbackForm();
  const feedbackButton = openForm ? (
    <Button
      aria-label={t('Give feedback on the query injection issue')}
      icon={<IconMegaphone />}
      size={'xs'}
      onClick={() =>
        openForm({
          messagePlaceholder: t('Please provide feedback on the query injection issue.'),
          tags: {
            ['feedback.source']: 'issue_details_query_injection',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;

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
        <Flex justify="space-between">
          <Flex align="center">
            <Breadcrumbs
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
          </Flex>
          <ButtonBar gap={0.5}>
            {!hasOnlyOneUIOption && !isQueryInjection && (
              <LinkButton
                size="xs"
                external
                title={t('Learn more about the new UI')}
                href={`https://docs.sentry.io/product/issues/issue-details/`}
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
            {isQueryInjection ? feedbackButton : <NewIssueExperienceButton />}
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
            {isQueryInjection && <FeatureBadge type="beta" />}
          </Title>
          <StatTitle>
            {issueTypeConfig.eventAndUserCounts.enabled && (
              <StatLink
                to={`${baseUrl}events/${location.search}`}
                aria-label={t('View events')}
              >
                {t('Events')}
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
          <Flex gap={space(1)} align="center">
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
  background-color: ${p => p.theme.background};
  padding: ${space(1)} 24px;
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
  font-weight: ${p => p.theme.fontWeightBold};
  flex-shrink: 0;
`;

const StatTitle = styled('div')`
  display: block;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeightBold};
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
  border-bottom: 1px solid ${p => p.theme.translucentBorder};
  position: relative;
  transition: background 0.3s ease-in-out;
  background: ${p => (p.isComplete ? 'transparent' : p.theme.background)};
  &:before {
    z-index: -1;
    position: absolute;
    inset: 0;
    content: '';
    background: linear-gradient(
      to right,
      ${p => p.theme.background},
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
    background: ${p => p.theme.translucentBorder};
  }
`;

const WorkflowActions = styled('div')`
  display: flex;
  justify-content: flex-end;
  column-gap: ${space(2)};
  flex-wrap: wrap;
  @media (max-width: ${p => p.theme.breakpoints.large}) {
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
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
