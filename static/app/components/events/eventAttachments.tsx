import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {
  useDeleteEventAttachmentOptimistic,
  useFetchEventAttachments,
} from 'sentry/actionCreators/events';
import {EventAttachmentActions} from 'sentry/components/events/eventAttachmentActions';
import {FileSize} from 'sentry/components/fileSize';
import {LoadingError} from 'sentry/components/loadingError';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {InlineEventAttachment} from 'sentry/views/issueDetails/groupEventAttachments/inlineEventAttachment';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';

import {EventAttachmentsCrashReportsNotice} from './eventAttachmentsCrashReportsNotice';

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
  const crashFileStripped = event.metadata.stripped_crash;

  if (isError) {
    return (
      <FoldSection sectionKey={SectionKey.ATTACHMENTS} title={t('Attachments')}>
        <LoadingError
          onRetry={refetch}
          message={t('An error occurred while fetching attachments')}
        />
      </FoldSection>
    );
  }

  if (!attachments.length && !crashFileStripped) {
    return null;
  }

  const title = t('Attachments (%s)', attachments.length);

  const togglePreview = (attachment: IssueAttachment) => {
    setAttachmentPreviews(previewsMap => ({
      ...previewsMap,
      [attachment.id]: !previewsMap[attachment.id],
    }));
  };

  return (
    <FoldSection
      sectionKey={SectionKey.ATTACHMENTS}
      title={title}
      actions={project && group ? <ViewAllGroupAttachmentsButton /> : null}
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
        <StyledSimpleTable
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>
                <Name>{t('File Name')}</Name>
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>
                <Size>{t('Size')}</Size>
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell>{t('Actions')}</SimpleTable.HeaderCell>
            </SimpleTable.HeaderRow>
          }
        >
          {attachments.map(attachment => (
            <Fragment key={attachment.id}>
              <SimpleTable.Row>
                <SimpleTable.RowCell>
                  <Name>{attachment.name}</Name>
                </SimpleTable.RowCell>

                <SimpleTable.RowCell>
                  <Size>
                    <FileSize bytes={attachment.size} />
                  </Size>
                </SimpleTable.RowCell>
                <SimpleTable.RowCell>
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
                    previewIsOpen={attachmentPreviewIsOpen(
                      attachmentPreviews,
                      attachment
                    )}
                  />
                </SimpleTable.RowCell>
              </SimpleTable.Row>
              {attachmentPreviewIsOpen(attachmentPreviews, attachment) ? (
                <SimpleTable.FullWidthRow>
                  <InlineEventAttachment
                    attachment={attachment}
                    eventId={event.id}
                    projectSlug={project.slug}
                  />
                </SimpleTable.FullWidthRow>
              ) : null}
            </Fragment>
          ))}
        </StyledSimpleTable>
      )}
    </FoldSection>
  );
}

export function EventAttachments(props: EventAttachmentsProps) {
  const organization = useOrganization();

  if (!organization.features.includes('event-attachments')) {
    return null;
  }

  return <EventAttachmentsContent {...props} />;
}

const StyledSimpleTable = styled(SimpleTable)`
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
