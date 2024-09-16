import styled from '@emotion/styled';
import xor from 'lodash/xor';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {useMutation} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import {useGroupEventAttachments} from 'sentry/views/issueDetails/groupEventAttachments/useGroupEventAttachments';

import GroupEventAttachmentsFilter, {
  crashReportTypes,
  SCREENSHOT_TYPE,
} from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';

type GroupEventAttachmentsProps = {
  project: Project;
};

const enum EventAttachmentFilter {
  ALL = 'all',
  CRASH_REPORTS = 'onlyCrash',
  SCREENSHOTS = 'screenshot',
}

function useActiveAttachmentsTab() {
  const location = useLocation();

  const types = decodeList(location.query.types);
  if (types.length === 0) {
    return EventAttachmentFilter.ALL;
  }
  if (types[0] === SCREENSHOT_TYPE) {
    return EventAttachmentFilter.SCREENSHOTS;
  }
  if (xor(crashReportTypes, types).length === 0) {
    return EventAttachmentFilter.CRASH_REPORTS;
  }
  return EventAttachmentFilter.ALL;
}

function GroupEventAttachments({project}: GroupEventAttachmentsProps) {
  const {groupId, orgId: orgSlug} = useParams<{groupId: string; orgId: string}>();
  const activeAttachmentsTab = useActiveAttachmentsTab();
  const api = useApi();
  const {attachments, isPending, isError, getResponseHeader, refetch} =
    useGroupEventAttachments({
      groupId,
      activeAttachmentsTab,
    });

  const {mutate: deleteAttachment} = useMutation({
    mutationFn: ({attachmentId, eventId}: {attachmentId: string; eventId: string}) =>
      api.requestPromise(
        `/projects/${orgSlug}/${project.slug}/events/${eventId}/attachments/${attachmentId}/`,
        {
          method: 'DELETE',
        }
      ),
    onError: () => {
      addErrorMessage('An error occurred while deleteting the attachment');
    },
  });

  const handleDelete = (deletedAttachmentId: string) => {
    const attachment = attachments.find(item => item.id === deletedAttachmentId);
    if (!attachment) {
      return;
    }

    // TODO handle delete optimistically
    // setDeletedAttachments(prevState => [...prevState, deletedAttachmentId]);

    deleteAttachment({attachmentId: attachment.id, eventId: attachment.event_id});
  };

  const renderAttachmentsTable = () => {
    if (isError) {
      return <LoadingError onRetry={refetch} message={t('Error loading attachments')} />;
    }

    return (
      <GroupEventAttachmentsTable
        isLoading={isPending}
        attachments={attachments}
        orgSlug={orgSlug}
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
      {activeAttachmentsTab === EventAttachmentFilter.SCREENSHOTS
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
