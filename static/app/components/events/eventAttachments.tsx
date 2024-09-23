import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {Button} from 'sentry/components/button';
import EventAttachmentActions from 'sentry/components/events/eventAttachmentActions';
import FileSize from 'sentry/components/fileSize';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';
import {useGroupEventAttachmentsDrawer} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachmentsDrawer';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type EventAttachmentsProps = {
  event: Event;
  /**
   * Group is not available everywhere this component is used
   */
  group: Group | undefined;
  project: Project;
};

type AttachmentPreviewOpenMap = Record<string, boolean>;

const attachmentPreviewIsOpen = (
  attachmentPreviews: Record<string, boolean>,
  attachment: IssueAttachment
) => {
  return attachmentPreviews[attachment.id] === true;
};

function ViewAllGroupAttachmentsButton({
  group,
  project,
}: {
  group: Group;
  project: Project;
}) {
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const {openAttachmentDrawer} = useGroupEventAttachmentsDrawer({
    project,
    group,
    openButtonRef,
  });

  return (
    <Button ref={openButtonRef} onClick={openAttachmentDrawer} size="xs">
      {t('View All Attachments')}
    </Button>
  );
}

function EventAttachmentsContent({event, project, group}: EventAttachmentsProps) {
  const organization = useOrganization();
  const {
    data: attachments = [],
    isError,
    refetch,
  } = useFetchEventAttachments({
    orgSlug: organization.slug,
    projectSlug: project.slug,
    eventId: event.id,
  });
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreviewOpenMap>(
    {}
  );
  const hasStreamlinedUI = useHasStreamlinedUI();
  const crashFileStripped = event.metadata.stripped_crash;

  if (isError) {
    return (
      <InterimSection type={SectionKey.ATTACHMENTS} title={t('Attachments')}>
        <LoadingError
          onRetry={refetch}
          message={t('An error occurred while fetching attachments')}
        />
      </InterimSection>
    );
  }

  if (!attachments.length && !crashFileStripped) {
    return null;
  }

  const title = t('Attachments (%s)', attachments.length);

  const lastAttachment = attachments.at(-1);
  const lastAttachmentPreviewed =
    lastAttachment && attachmentPreviewIsOpen(attachmentPreviews, lastAttachment);

  const togglePreview = (attachment: IssueAttachment) => {
    setAttachmentPreviews(previewsMap => ({
      ...previewsMap,
      [attachment.id]: !previewsMap[attachment.id],
    }));
  };

  return (
    <InterimSection
      type={SectionKey.ATTACHMENTS}
      title={title}
      actions={
        hasStreamlinedUI && project && group ? (
          <ViewAllGroupAttachmentsButton group={group} project={project} />
        ) : null
      }
    >
      {crashFileStripped && (
        <EventAttachmentsCrashReportsNotice
          orgSlug={organization.slug}
          projectSlug={project.slug}
          groupId={event.groupID!}
        />
      )}

      {attachments.length > 0 && (
        <StyledPanelTable
          headers={[
            <Name key="name">{t('File Name')}</Name>,
            <Size key="size">{t('Size')}</Size>,
            t('Actions'),
          ]}
        >
          {attachments.map(attachment => (
            <Fragment key={attachment.id}>
              <FlexCenter>
                <Name>{attachment.name}</Name>
              </FlexCenter>
              <Size>
                <FileSize bytes={attachment.size} />
              </Size>
              <div>
                <EventAttachmentActions
                  withPreviewButton
                  attachment={attachment}
                  projectSlug={project.slug}
                  onDelete={() =>
                    deleteAttachment({
                      orgSlug: organization.slug,
                      projectSlug: project.slug,
                      eventId: event.id,
                      attachmentId: attachment.id,
                    })
                  }
                  onPreviewClick={() => togglePreview(attachment)}
                  previewIsOpen={attachmentPreviewIsOpen(attachmentPreviews, attachment)}
                />
              </div>
              {attachmentPreviewIsOpen(attachmentPreviews, attachment) ? (
                <InlineEventAttachment
                  attachment={attachment}
                  eventId={event.id}
                  projectSlug={project.slug}
                />
              ) : null}
              {/* XXX: hack to deal with table grid borders */}
              {lastAttachmentPreviewed && (
                <Fragment>
                  <div style={{display: 'none'}} />
                  <div style={{display: 'none'}} />
                </Fragment>
              )}
            </Fragment>
          ))}
        </StyledPanelTable>
      )}
    </InterimSection>
  );
}

export function EventAttachments(props: EventAttachmentsProps) {
  const organization = useOrganization();

  if (!organization.features.includes('event-attachments')) {
    return null;
  }

  return <EventAttachmentsContent {...props} />;
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr auto auto;
`;

const FlexCenter = styled('div')`
  ${p => p.theme.overflowEllipsis};
  display: flex;
  align-items: center;
`;

const Name = styled('div')`
  ${p => p.theme.overflowEllipsis};
  white-space: nowrap;
`;

const Size = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
`;
