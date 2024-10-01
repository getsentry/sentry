import {useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {ReplayDrawer} from 'sentry/components/events/eventReplay/replayDrawer';
import {UserFeedbackDrawer} from 'sentry/components/events/userFeedback/userFeedbackDrawer';
import useDrawer, {type DrawerOptions} from 'sentry/components/globalDrawer';
import {IconAttachment, IconMegaphone, IconPlay, IconTag} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {keepPreviousData} from 'sentry/utils/queryClient';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';
import {useGroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachmentsDrawer';
import {useGroupTagsDrawer} from 'sentry/views/issueDetails/groupTags/useGroupTagsDrawer';

interface IssueCalloutsProps {
  group: Group;
  project: Project;
}

export function IssueCallouts({group, project}: IssueCalloutsProps) {
  return (
    <CalloutContainer>
      <AttachmentCallout group={group} project={project} />
      <UserFeedbackCallout group={group} project={project} />
      <ReplayCallout group={group} project={project} />
      <TagsCallout group={group} project={project} />
    </CalloutContainer>
  );
}

function AttachmentCallout({group, project}: IssueCalloutsProps) {
  const attachments = useGroupEventAttachments({
    groupId: group.id,
    activeAttachmentsTab: 'all',
    options: {placeholderData: keepPreviousData},
  });
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {openAttachmentDrawer} = useGroupEventAttachmentsDrawer({
    project,
    group,
    openButtonRef,
  });

  const attachmentPagination = parseLinkHeader(
    attachments.getResponseHeader?.('Link') ?? null
  );

  // Since we reuse whatever page the user was on, we can look at pagination to determine if there are more attachments
  const hasManyAttachments =
    attachmentPagination.next?.results || attachmentPagination.previous?.results;

  return (
    <CalloutItem
      ref={openButtonRef}
      borderless
      icon={<IconAttachment size="xs" />}
      onClick={() => {
        openAttachmentDrawer();
      }}
      disabled={!attachments.attachments.length && !hasManyAttachments}
    >
      {hasManyAttachments
        ? t('50+ Attachments')
        : tn('%s Attachment', '%s Attachments', attachments.attachments.length)}
    </CalloutItem>
  );
}

function UserFeedbackCallout({group, project}: IssueCalloutsProps) {
  const {openDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const drawerOptions: DrawerOptions = {
    ariaLabel: 'user feedback drawer',
    shouldCloseOnInteractOutside: el => {
      if (openButtonRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
  };
  const issueTypeConfig = getConfigForIssueType(group, project);

  if (!issueTypeConfig.userFeedback.enabled) {
    return null;
  }

  return (
    <CalloutItem
      borderless
      icon={<IconMegaphone size="xs" />}
      onClick={() => {
        openDrawer(
          () => <UserFeedbackDrawer group={group} project={project} />,
          drawerOptions
        );
      }}
      disabled={group.userReportCount <= 0}
    >
      {tn('%s User Report', '%s User Reports', group.userReportCount)}
    </CalloutItem>
  );
}

function ReplayCallout({group, project}: IssueCalloutsProps) {
  const {openDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const drawerOptions: DrawerOptions = {
    ariaLabel: 'replay drawer',
    shouldCloseOnInteractOutside: el => {
      if (openButtonRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
  };
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  if (!issueTypeConfig.replays.enabled) {
    return null;
  }

  return (
    <CalloutItem
      ref={openButtonRef}
      borderless
      icon={<IconPlay size="xs" />}
      onClick={() => {
        openDrawer(() => <ReplayDrawer group={group} project={project} />, drawerOptions);
      }}
      disabled={replaysCount <= 0}
    >
      {tn('%s Replay', '%s Replays', replaysCount)}
    </CalloutItem>
  );
}

function TagsCallout({group, project}: IssueCalloutsProps) {
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {openTagsDrawer} = useGroupTagsDrawer({
    projectSlug: project.slug,
    groupId: group.id,
    openButtonRef: openButtonRef,
  });
  return (
    <CalloutItem
      ref={openButtonRef}
      borderless
      icon={<IconTag size="xs" />}
      onClick={() => {
        openTagsDrawer();
      }}
    >
      {t('View All Tags')}
    </CalloutItem>
  );
}

const CalloutContainer = styled('div')`
  display: flex;
`;
const CalloutItem = styled(Button)`
  flex: 1;
  color: ${p => p.theme.textColor};
`;
