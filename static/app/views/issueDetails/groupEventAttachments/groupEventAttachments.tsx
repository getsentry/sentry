import {useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';
import xor from 'lodash/xor';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAttachment, Project} from 'sentry/types';
import {useApiQuery, useMutation} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

import GroupEventAttachmentsFilter, {
  crashReportTypes,
  SCREENSHOT_TYPE,
} from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';

type GroupEventAttachmentsProps = {
  project: Project;
};

enum EventAttachmentFilter {
  ALL = 'all',
  CRASH_REPORTS = 'onlyCrash',
  SCREENSHOTS = 'screenshot',
}

export const MAX_SCREENSHOTS_PER_PAGE = 12;

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
  const location = useLocation();
  const {groupId, orgId} = useParams<{groupId: string; orgId: string}>();
  const activeAttachmentsTab = useActiveAttachmentsTab();
  const [deletedAttachments, setDeletedAttachments] = useState<string[]>([]);
  const api = useApi();

  const {
    data: eventAttachments,
    isLoading,
    isError,
    getResponseHeader,
    refetch,
  } = useApiQuery<IssueAttachment[]>(
    [
      `/organizations/${orgId}/issues/${groupId}/attachments/`,
      {
        query:
          activeAttachmentsTab === EventAttachmentFilter.SCREENSHOTS
            ? {
                ...location.query,
                types: undefined, // need to explicitly set this to undefined because AsyncComponent adds location query back into the params
                screenshot: 1,
                per_page: MAX_SCREENSHOTS_PER_PAGE,
              }
            : {
                ...pick(location.query, ['cursor', 'environment', 'types']),
                per_page: 50,
              },
      },
    ],
    {staleTime: 0}
  );

  const {mutate: deleteAttachment} = useMutation({
    mutationFn: ({attachmentId, eventId}: {attachmentId: string; eventId: string}) =>
      api.requestPromise(
        `/projects/${orgId}/${project.slug}/events/${eventId}/attachments/${attachmentId}/`,
        {
          method: 'DELETE',
        }
      ),
    onError: () => {
      addErrorMessage('An error occurred while deleteting the attachment');
    },
  });

  const handleDelete = (deletedAttachmentId: string) => {
    const attachment = eventAttachments?.find(item => item.id === deletedAttachmentId);
    if (!attachment) {
      return;
    }

    setDeletedAttachments(prevState => [...prevState, deletedAttachmentId]);

    deleteAttachment({attachmentId: attachment.id, eventId: attachment.event_id});
  };

  const renderInnerBody = () => {
    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (
        <GroupEventAttachmentsTable
          attachments={eventAttachments}
          orgId={orgId}
          projectSlug={project.slug}
          groupId={groupId}
          onDelete={handleDelete}
          deletedAttachments={deletedAttachments}
        />
      );
    }

    if (activeAttachmentsTab === EventAttachmentFilter.CRASH_REPORTS) {
      return (
        <EmptyStateWarning>
          <p>{t('No crash reports found')}</p>
        </EmptyStateWarning>
      );
    }

    return (
      <EmptyStateWarning>
        <p>{t('No attachments found')}</p>
      </EmptyStateWarning>
    );
  };

  const renderAttachmentsTable = () => {
    if (isError) {
      return <LoadingError onRetry={refetch} message={t('Error loading attachments')} />;
    }

    return (
      <Panel className="event-list">
        <PanelBody>{renderInnerBody()}</PanelBody>
      </Panel>
    );
  };

  const renderScreenshotGallery = () => {
    if (isError) {
      return <LoadingError onRetry={refetch} message={t('Error loading screenshots')} />;
    }

    if (isLoading) {
      return <LoadingIndicator />;
    }

    if (eventAttachments && eventAttachments.length > 0) {
      return (
        <ScreenshotGrid>
          {eventAttachments?.map((screenshot, index) => {
            return (
              <ScreenshotCard
                key={`${index}-${screenshot.id}`}
                eventAttachment={screenshot}
                eventId={screenshot.event_id}
                projectSlug={project.slug}
                groupId={groupId}
                onDelete={handleDelete}
                pageLinks={getResponseHeader?.('Link')}
                attachments={eventAttachments}
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
    <Layout.Body>
      <Layout.Main fullWidth>
        <GroupEventAttachmentsFilter project={project} />
        {activeAttachmentsTab === EventAttachmentFilter.SCREENSHOTS
          ? renderScreenshotGallery()
          : renderAttachmentsTable()}
        <Pagination pageLinks={getResponseHeader?.('Link')} />
      </Layout.Main>
    </Layout.Body>
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
