import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Flex} from '@sentry/scraps/layout';

import {EventMessage} from 'sentry/components/events/eventMessage';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getMessage, getTitle} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Divider} from 'sentry/views/issueDetails/divider';
import {GroupPriority} from 'sentry/views/issueDetails/groupPriority';
import {GroupHeaderAssigneeSelector} from 'sentry/views/issueDetails/header/assigneeSelector';
import {GroupStatusSubtitle} from 'sentry/views/issueDetails/header/groupStatusSubtitle';
import {useIssueIdBreadcrumbItem} from 'sentry/views/issueDetails/header/issueIdBreadcrumb';
import {
  getGroupReprocessingStatus,
  ReprocessingStatus,
} from 'sentry/views/issueDetails/utils';
import {IssueStatCounts} from 'sentry/views/issueDetailsRedesign/issueStatCounts';
import {ParticipantsViewers} from 'sentry/views/issueDetailsRedesign/participantsViewers';
import {RedesignHeaderActions} from 'sentry/views/issueDetailsRedesign/redesignHeaderActions';
import {TopBar} from 'sentry/views/navigation/topBar';

interface RedesignHeaderProps {
  event: Event | null;
  group: Group;
  project: Project;
}

/**
 * A redesign-owned header for the experimental issue page. Layout, top to bottom:
 * breadcrumb + primary actions, then title + inline stat counts, the message,
 * the issue status line, and finally a bottom-left workflow cluster (priority,
 * assignee, participants). The classic `GroupHeader` is intentionally untouched.
 */
export function RedesignHeader({group, project, event}: RedesignHeaderProps) {
  const organization = useOrganization();
  const location = useLocation();

  const {title: primaryTitle} = getTitle(group);
  const secondaryTitle = getMessage(group);
  const {sort: _sort, ...query} = location.query;
  const issueItem = useIssueIdBreadcrumbItem({project, group});

  const disableActions = [
    ReprocessingStatus.REPROCESSING,
    ReprocessingStatus.REPROCESSED_AND_HASNT_EVENT,
  ].includes(getGroupReprocessingStatus(group));

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList
          items={[
            {
              type: 'link',
              label: t('Issues'),
              to: {
                pathname: `/organizations/${organization.slug}/issues/`,
                query,
              },
            },
          ]}
        />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        <BreadcrumbList.Title item={issueItem} />
      </TopBar.Slot>
      <Header>
        <TitleRow>
          <PrimaryTitle title={primaryTitle}>{primaryTitle}</PrimaryTitle>
          <IssueStatCounts group={group} project={project} />
        </TitleRow>
        <EventMessage level={group.level} message={secondaryTitle} type={group.type} />
        <StatusRow>
          <GroupStatusSubtitle group={group} project={project} />
          <Flex align="center" gap="xs" flexShrink={0}>
            <SeenLabel>{t('Last')}</SeenLabel>
            <TimeSince
              date={group.lifetime?.lastSeen ?? group.lastSeen}
              suffix=""
              unitStyle="short"
              tooltipPrefix={t('Last Seen')}
            />
            <Divider />
            <SeenLabel>{t('First')}</SeenLabel>
            <TimeSince
              date={group.lifetime?.firstSeen ?? group.firstSeen}
              suffix=""
              unitStyle="short"
              tooltipPrefix={t('First Seen')}
            />
          </Flex>
        </StatusRow>
        {/* Action bar: primary CTAs on the left, workflow controls (priority,
          assignee, participants) right-aligned on the same row. */}
        <ActionBar>
          <RedesignHeaderActions
            group={group}
            project={project}
            event={event}
            disabled={disableActions}
          />
          <WorkflowCluster>
            <GroupPriority group={group} showChevron={false} />
            <GroupHeaderAssigneeSelector
              group={group}
              project={project}
              event={event}
              avatarSize={24}
              showLabel={false}
              showChevron={false}
              bare
            />
            <Divider />
            <ParticipantsViewers group={group} />
          </WorkflowCluster>
        </ActionBar>
      </Header>
    </Fragment>
  );
}

const Header = styled('header')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.lg}
    var(--issue-details-inset, ${p => p.theme.space['2xl']});
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
`;

// Bottom action bar: CTAs on the left, workflow controls on the right.
const ActionBar = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
  flex-wrap: wrap;
  margin-top: ${p => p.theme.space.xs};
`;

// Priority, assignee and participants, right-aligned on the action bar.
const WorkflowCluster = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  flex-shrink: 0;
`;

const StatusRow = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
`;

const SeenLabel = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;

const TitleRow = styled('div')`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
`;

const PrimaryTitle = styled('h1')`
  margin: 0;
  overflow-x: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;
