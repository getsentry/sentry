import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

import GroupEventAttachmentsFilter, {
  EventAttachmentFilter,
} from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';
import {useDeleteGroupEventAttachment} from './useDeleteGroupEventAttachment';
import {useGroupEventAttachments} from './useGroupEventAttachments';

type GroupEventAttachmentsProps = {
  groupId: string;
  project: Project;
};

function GroupEventAttachments({project, groupId}: GroupEventAttachmentsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const activeAttachmentsTab =
    (location.query.attachmentFilter as EventAttachmentFilter | undefined) ??
    EventAttachmentFilter.ALL;
  const {attachments, isPending, isError, getResponseHeader, refetch} =
    useGroupEventAttachments({
      groupId,
      activeAttachmentsTab,
    });

  const {mutate: deleteAttachment} = useDeleteGroupEventAttachment();

  const handleDelete = (attachment: IssueAttachment) => {
    deleteAttachment({
      attachment,
      groupId,
      orgSlug: organization.slug,
      activeAttachmentsTab,
      projectSlug: project.slug,
      cursor: location.query.cursor as string | undefined,
      environment: location.query.environment as string[] | string | undefined,
    });
  };

  const renderAttachmentsTable = () => {
    if (isError) {
      return <LoadingError onRetry={refetch} message={t('Error loading attachments')} />;
    }

    return (
      <GroupEventAttachmentsTable
        isLoading={isPending}
        attachments={attachments}
        projectSlug={project.slug}
        groupId={groupId}
        onDelete={handleDelete}
        emptyMessage={
          activeAttachmentsTab === EventAttachmentFilter.CRASH_REPORTS
            ? t('No crash reports found')
            : t('No attachments found')
        }
      />
    );
  };

  const renderScreenshotGallery = () => {
    if (isError) {
      return <LoadingError onRetry={refetch} message={t('Error loading screenshots')} />;
    }

    if (isPending) {
      return <LoadingIndicator />;
    }

    if (attachments.length > 0) {
      return (
        <ScreenshotGrid>
          {attachments.map((screenshot, index) => {
            return (
              <ScreenshotCard
                key={`${index}-${screenshot.id}`}
                eventAttachment={screenshot}
                eventId={screenshot.event_id}
                projectSlug={project.slug}
                groupId={groupId}
                onDelete={handleDelete}
                pageLinks={getResponseHeader?.('Link')}
                attachments={attachments}
                attachmentIndex={index}
              />
            );
          })}
        </ScreenshotGrid>
      );
    }

    return (
      <EmptyStateWarning>
        <p>{t('No screenshots found')}</p>
      </EmptyStateWarning>
    );
  };

  return (
    <Wrapper>
      <GroupEventAttachmentsFilter project={project} />
      {activeAttachmentsTab === EventAttachmentFilter.SCREENSHOT
        ? renderScreenshotGallery()
        : renderAttachmentsTable()}
      <NoMarginPagination pageLinks={getResponseHeader?.('Link')} />
    </Wrapper>
  );
}

export default GroupEventAttachments;

const ScreenshotGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-template-rows: repeat(2, max-content);
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(4, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints.xxlarge}) {
    grid-template-columns: repeat(6, minmax(100px, 1fr));
  }
`;

const NoMarginPagination = styled(Pagination)`
  margin: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
