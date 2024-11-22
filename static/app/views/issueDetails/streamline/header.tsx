import {Fragment} from 'react';
import styled from '@emotion/styled';
import Color from 'color';

import {openModal} from 'sentry/actionCreators/modal';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import Count from 'sentry/components/count';
import ErrorLevel from 'sentry/components/events/errorLevel';
import {getBadgeProperties} from 'sentry/components/group/inboxBadges/statusBadge';
import UnhandledTag from 'sentry/components/group/inboxBadges/unhandledTag';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconGlobe} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import GroupActions from 'sentry/views/issueDetails/actions/index';
import {NewIssueExperienceButton} from 'sentry/views/issueDetails/actions/newIssueExperienceButton';
import ShareIssueModal, {getShareUrl} from 'sentry/views/issueDetails/actions/shareModal';
import {Divider} from 'sentry/views/issueDetails/divider';
import GroupPriority from 'sentry/views/issueDetails/groupPriority';
import {ShortIdBreadcrumb} from 'sentry/views/issueDetails/shortIdBreadcrumb';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/streamline/assigneeSelector';
import {AttachmentsBadge} from 'sentry/views/issueDetails/streamline/attachmentsBadge';
import {ReplayBadge} from 'sentry/views/issueDetails/streamline/replayBadge';
import {UserFeedbackBadge} from 'sentry/views/issueDetails/streamline/userFeedbackBadge';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {ReprocessingStatus} from 'sentry/views/issueDetails/utils';

interface GroupHeaderProps {
  event: Event | null;
  group: Group;
  groupReprocessingStatus: ReprocessingStatus;
  project: Project;
}

export default function StreamlinedGroupHeader({
  event,
  group,
  groupReprocessingStatus,
  project,
}: GroupHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {baseUrl} = useGroupDetailsRoute();
  const {sort: _sort, ...query} = location.query;
  const {count: eventCount, userCount} = group;
  const {title: primaryTitle, subtitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const isComplete = group.status === 'resolved' || group.status === 'ignored';
  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(groupReprocessingStatus);

  const statusProps = getBadgeProperties(group.status, group.substatus);
  const shareUrl = group?.shareId ? getShareUrl(group) : null;

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
                  label: (
                    <ShortIdBreadcrumb
                      organization={organization}
                      project={project}
                      group={group}
                    />
                  ),
                },
              ]}
            />
            {group.isPublic && shareUrl ? (
              <Button
                size="xs"
                borderless
                aria-label={t('View issue share settings')}
                title={tct('This issue has been shared [link:with a public link].', {
                  link: <ExternalLink href={shareUrl} />,
                })}
                tooltipProps={{isHoverable: true}}
                icon={
                  <IconGlobe
                    size="xs"
                    color="subText"
                    onClick={() =>
                      openModal(modalProps => (
                        <ShareIssueModal
                          {...modalProps}
                          organization={organization}
                          projectSlug={group.project.slug}
                          groupId={group.id}
                          onToggle={() =>
                            trackAnalytics('issue.shared_publicly', {
                              organization,
                            })
                          }
                        />
                      ))
                    }
                  />
                }
              />
            ) : null}
          </Flex>
          <NewIssueExperienceButton />
        </Flex>
        <HeaderGrid>
          <Flex gap={space(0.75)} align="baseline">
            <PrimaryTitle
              title={primaryTitle}
              isHoverable
              showOnlyOnOverflow
              delay={1000}
            >
              {primaryTitle}
            </PrimaryTitle>
            <SecondaryTitle
              title={secondaryTitle}
              isHoverable
              showOnlyOnOverflow
              delay={1000}
              isDefault={!secondaryTitle}
            >
              {secondaryTitle ?? t('No error message')}
            </SecondaryTitle>
          </Flex>
          <StatTitle>
            <StatLink
              to={`${baseUrl}events/${location.search}`}
              aria-label={t('View events')}
            >
              {t('Events')}
            </StatLink>
          </StatTitle>
          <StatTitle>
            {userCount === 0 ? (
              t('Users')
            ) : (
              <StatLink
                to={`${baseUrl}tags/user/${location.search}`}
                aria-label={t('View affected users')}
              >
                {t('Users')}
              </StatLink>
            )}
          </StatTitle>
          <Flex gap={space(1)} align="center" justify="flex-start">
            <ErrorLevel level={group.level} size={'10px'} />
            {group.isUnhandled && <UnhandledTag />}
            {statusProps?.status ? (
              <Fragment>
                <Divider />
                <Tooltip title={statusProps?.tooltip}>
                  <Subtext>{statusProps?.status}</Subtext>
                </Tooltip>
              </Fragment>
            ) : null}
            {subtitle && (
              <Fragment>
                <Divider />
                <Subtitle title={subtitle} isHoverable showOnlyOnOverflow delay={1000}>
                  <Subtext>{subtitle}</Subtext>
                </Subtitle>
              </Fragment>
            )}
            <AttachmentsBadge group={group} />
            <UserFeedbackBadge group={group} project={project} />
            <ReplayBadge group={group} project={project} />
          </Flex>
          <StatCount value={eventCount} aria-label={t('Event count')} />
          <GuideAnchor target="issue_header_stats">
            <StatCount value={userCount} aria-label={t('User count')} />
          </GuideAnchor>
        </HeaderGrid>
      </Header>
      <ActionBar isComplete={isComplete} role="banner">
        <GroupActions
          group={group}
          project={project}
          disabled={disableActions}
          event={event}
          query={location.query}
        />
        <WorkflowActions>
          <Workflow>
            {t('Priority')}
            <GroupPriority group={group} />
          </Workflow>
          <GuideAnchor target="issue_sidebar_owners" position="left">
            <Workflow>
              {t('Assignee')}
              <GroupHeaderAssigneeSelector
                group={group}
                project={project}
                event={event}
              />
            </Workflow>
          </GuideAnchor>
        </WorkflowActions>
      </ActionBar>
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

const PrimaryTitle = styled(Tooltip)`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: ${p => p.theme.fontWeightBold};
  flex-shrink: 0;
`;

const SecondaryTitle = styled(Tooltip)<{isDefault: boolean}>`
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: ${p => (p.isDefault ? 'italic' : 'initial')};
`;

const StatTitle = styled('div')`
  display: block;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
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
`;

const Subtitle = styled(Tooltip)`
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
  gap: ${space(0.5)};
  color: ${p => p.theme.subText};
  align-items: center;
`;
