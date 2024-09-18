import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import EventAttachmentActions from 'sentry/components/events/eventAttachmentActions';
import FileSize from 'sentry/components/fileSize';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {IssueAttachment} from 'sentry/types/group';
import useOrganization from 'sentry/utils/useOrganization';
import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type EventAttachmentsProps = {
  event: Event;
  projectSlug: string;
};

type AttachmentPreviewOpenMap = Record<string, boolean>;

const attachmentPreviewIsOpen = (
  attachmentPreviews: Record<string, boolean>,
  attachment: IssueAttachment
) => {
  return attachmentPreviews[attachment.id] === true;
};

function EventAttachmentsContent({event, projectSlug}: EventAttachmentsProps) {
  const organization = useOrganization();
  const {
    data: attachments = [],
    isError,
    refetch,
  } = useFetchEventAttachments({
    orgSlug: organization.slug,
    projectSlug,
    eventId: event.id,
  });
  const {mutate: deleteAttachment} = useDeleteEventAttachmentOptimistic();
  const [attachmentPreviews, setAttachmentPreviews] = useState<AttachmentPreviewOpenMap>(
    {}
  );
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
    <InterimSection type={SectionKey.ATTACHMENTS} title={title}>
      {crashFileStripped && (
        <EventAttachmentsCrashReportsNotice
          orgSlug={organization.slug}
          projectSlug={projectSlug}
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
                  projectSlug={projectSlug}
                  onDelete={() =>
                    deleteAttachment({
                      orgSlug: organization.slug,
                      projectSlug,
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
                  projectSlug={projectSlug}
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
