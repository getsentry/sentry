import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import GroupEventAttachmentsFilter, {
  EventAttachmentFilter,
} from './groupEventAttachmentsFilter';
import GroupEventAttachmentsTable from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';
import {useDeleteGroupEventAttachment} from './useDeleteGroupEventAttachment';
import {useGroupEventAttachments} from './useGroupEventAttachments';

type GroupEventAttachmentsProps = {
  group: Group;
  project: Project;
};

const DEFAULT_ATTACHMENTS_TAB = EventAttachmentFilter.ALL;

function GroupEventAttachments({project, group}: GroupEventAttachmentsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const eventQuery = useEventQuery({groupId: group.id});
  const eventView = useIssueDetailsEventView({group});
  const navigate = useNavigate();
  const [previouslyUsedAttachmentsTab, setPreviouslyUsedAttachmentsTab] =
    useLocalStorageState(
      `issue-details-attachments-default-tab-${project.id}`,
      DEFAULT_ATTACHMENTS_TAB
    );

  const activeAttachmentsTab =
    (location.query.attachmentFilter as EventAttachmentFilter | undefined) ??
    previouslyUsedAttachmentsTab ??
    DEFAULT_ATTACHMENTS_TAB;

  // Persist the previously used attachments tab in the url if it's not already set
  useEffect(() => {
    if (
      !location.query.attachmentFilter &&
      previouslyUsedAttachmentsTab !== DEFAULT_ATTACHMENTS_TAB
    ) {
      navigate(
        {
          pathname: location.pathname,
          query: {...location.query, attachmentFilter: previouslyUsedAttachmentsTab},
        },
        {replace: true}
      );
    }
  }, [previouslyUsedAttachmentsTab, location, navigate]);

  const {attachments, isPending, isError, getResponseHeader, refetch} =
    useGroupEventAttachments({
      group,
      activeAttachmentsTab,
    });

  const {mutate: deleteAttachment} = useDeleteGroupEventAttachment();

  const handleDelete = (attachment: IssueAttachment) => {
    deleteAttachment({
      attachment,
      projectSlug: project.slug,
      activeAttachmentsTab,
      group,
      orgSlug: organization.slug,
      cursor: location.query.cursor as string | undefined,
      // We only want to filter by date/query/environment if we're using the Streamlined UI
      environment: hasStreamlinedUI ? (eventView.environment as string[]) : undefined,
      start: hasStreamlinedUI ? eventView.start : undefined,
      end: hasStreamlinedUI ? eventView.end : undefined,
      statsPeriod: hasStreamlinedUI ? eventView.statsPeriod : undefined,
      eventQuery: hasStreamlinedUI ? eventQuery : undefined,
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
        groupId={group.id}
        onDelete={handleDelete}
        emptyMessage={
          activeAttachmentsTab === EventAttachmentFilter.CRASH_REPORTS
            ? t('No matching crash reports found')
            : t('No matching attachments found')
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
          {attachments.map(screenshot => {
            return (
              <ScreenshotCard
                key={screenshot.id}
                eventAttachment={screenshot}
                eventId={screenshot.event_id}
                projectSlug={project.slug}
                groupId={group.id}
                onDelete={handleDelete}
                attachments={attachments}
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
      {hasStreamlinedUI ? (
        <Flex justify="space-between">
          <FilterMessage align="center" gap={space(1)}>
            <IconFilter size="xs" />
            {t('Results are filtered by the selections above.')}
          </FilterMessage>
          <GroupEventAttachmentsFilter
            onChange={key => setPreviouslyUsedAttachmentsTab(key)}
          />
        </Flex>
      ) : (
        <GroupEventAttachmentsFilter />
      )}
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

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
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

const FilterMessage = styled(Flex)``;
