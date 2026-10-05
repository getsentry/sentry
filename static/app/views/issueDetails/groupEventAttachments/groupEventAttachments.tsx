import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/hooks/useEventQuery';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/hooks/useIssueDetailsDiscoverQuery';

import {
  EventAttachmentFilter,
  GroupEventAttachmentsFilter,
} from './groupEventAttachmentsFilter';
import {GroupEventAttachmentsTable} from './groupEventAttachmentsTable';
import {ScreenshotCard} from './screenshotCard';
import {useDeleteGroupEventAttachment} from './useDeleteGroupEventAttachment';
import {useGroupEventAttachments} from './useGroupEventAttachments';

type GroupEventAttachmentsProps = {
  group: Group;
  project: Project;
};

const DEFAULT_ATTACHMENTS_TAB = EventAttachmentFilter.ALL;

export function GroupEventAttachments({project, group}: GroupEventAttachmentsProps) {
  const location = useLocation();
  const organization = useOrganization();
  const eventQuery = useEventQuery();
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

  const {attachments, isPending, isError, pageLinks, refetch} = useGroupEventAttachments({
    group,
    activeAttachmentsTab,
  });

  const {mutate: deleteAttachment} = useDeleteGroupEventAttachment();

  const hasSetStatsPeriod =
    location.query.statsPeriod || location.query.start || location.query.end;

  const handleDelete = (attachment: IssueAttachment) => {
    deleteAttachment({
      attachment,
      projectSlug: project.slug,
      activeAttachmentsTab,
      group,
      orgSlug: organization.slug,
      cursor: location.query.cursor as string | undefined,
      environment: eventView.environment as string[],
      eventQuery,
      ...(hasSetStatsPeriod && {
        start: eventView.start,
        end: eventView.end,
        statsPeriod: eventView.statsPeriod,
      }),
    });
  };

  const attachmentsTable = isError ? (
    <LoadingError onRetry={refetch} message={t('Error loading attachments')} />
  ) : (
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

  const screenshotGallery = isError ? (
    <LoadingError onRetry={refetch} message={t('Error loading screenshots')} />
  ) : isPending ? (
    <LoadingIndicator />
  ) : attachments.length > 0 ? (
    <Grid
      columns={{
        zero: 'minmax(0, 1fr)',
        '2xs': 'repeat(2, minmax(0, 1fr))',
        md: 'repeat(3, minmax(0, 1fr))',
        xl: 'repeat(4, minmax(0, 1fr))',
      }}
      gap="xl"
    >
      {attachments.map(screenshot => (
        <ScreenshotCard
          key={screenshot.id}
          eventAttachment={screenshot}
          eventId={screenshot.event_id}
          projectSlug={project.slug}
          groupId={group.id}
          onDelete={handleDelete}
          attachments={attachments}
        />
      ))}
    </Grid>
  ) : (
    <EmptyStateWarning>
      <p>{t('No screenshots found')}</p>
    </EmptyStateWarning>
  );

  return (
    <Stack gap="xl">
      <Flex justify="between" align="center" wrap="wrap" gap="md">
        <Flex align="center" gap="md">
          <IconFilter size="xs" />
          {t('Results are filtered by the selections above.')}
        </Flex>
        <GroupEventAttachmentsFilter
          onChange={key => setPreviouslyUsedAttachmentsTab(key)}
        />
      </Flex>
      {activeAttachmentsTab === EventAttachmentFilter.SCREENSHOT
        ? screenshotGallery
        : attachmentsTable}
      <NoMarginPagination pageLinks={pageLinks} />
    </Stack>
  );
}

const NoMarginPagination = styled(Pagination)`
  margin: 0;
`;
