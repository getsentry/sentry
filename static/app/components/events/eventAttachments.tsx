import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import EventAttachmentActions from 'sentry/components/events/eventAttachmentActions';
import FileSize from 'sentry/components/fileSize';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import EventAttachmentsCrashReportsNotice from './eventAttachmentsCrashReportsNotice';

type EventAttachmentsProps = {
  event: Event;
  /**
   * Group is not available everywhere this component is used
   */
  group: Group | undefined;
  project: Project;
  disableCollapsePersistence?: boolean;
};

type AttachmentPreviewOpenMap = Record<string, boolean>;

const attachmentPreviewIsOpen = (
  attachmentPreviews: Record<string, boolean>,
  attachment: IssueAttachment
) => {
  return attachmentPreviews[attachment.id] === true;
};

function ViewAllGroupAttachmentsButton() {
  const {baseUrl} = useGroupDetailsRoute();
  const location = useLocation();

  return (
    <LinkButton
      size="xs"
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.ATTACHMENTS]}`,
        query: location.query,
      }}
    >
      {t('View All Attachments')}
    </LinkButton>
  );
}

function EventAttachmentsContent({
  event,
  project,
  group,
  disableCollapsePersistence,
}: EventAttachmentsProps) {
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
        hasStreamlinedUI && project && group ? <ViewAllGroupAttachmentsButton /> : null
      }
      disableCollapsePersistence={disableCollapsePersistence}
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
              <Flex align="center">
                <Name>{attachment.name}</Name>
              </Flex>

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

const Name = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const Size = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  white-space: nowrap;
`;
