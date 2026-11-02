import {useEffect} from 'react';
import styled from '@emotion/styled';
import {IconFilter} from '@sentry/icons/filter';
import {parseAsString, useQueryStates} from 'nuqs';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Pagination} from '@sentry/scraps/pagination';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Group, IssueAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {pageFilterParsers} from 'sentry/utils/url/pageFilterParsers';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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
  const [{attachmentFilter, cursor, statsPeriod, start, end}, setQueryParams] =
    useQueryStates({
      attachmentFilter: parseAsString,
      cursor: parseAsString,
      statsPeriod: pageFilterParsers.statsPeriod,
      start: pageFilterParsers.start,
      end: pageFilterParsers.end,
    });
  const organization = useOrganization();
  const eventQuery = useEventQuery();
  const eventView = useIssueDetailsEventView({group});
  const [previouslyUsedAttachmentsTab, setPreviouslyUsedAttachmentsTab] =
    useLocalStorageState(
      `issue-details-attachments-default-tab-${project.id}`,
      DEFAULT_ATTACHMENTS_TAB
    );

  const activeAttachmentsTab =
    (attachmentFilter as EventAttachmentFilter | null) ??
    previouslyUsedAttachmentsTab ??
    DEFAULT_ATTACHMENTS_TAB;

  // Persist the previously used attachments tab in the url if it's not already set
  useEffect(() => {
    if (!attachmentFilter && previouslyUsedAttachmentsTab !== DEFAULT_ATTACHMENTS_TAB) {
      setQueryParams({attachmentFilter: previouslyUsedAttachmentsTab});
    }
  }, [attachmentFilter, previouslyUsedAttachmentsTab, setQueryParams]);

  const {attachments, isPending, isError, pageLinks, refetch} = useGroupEventAttachments({
    group,
    activeAttachmentsTab,
  });

  const {mutate: deleteAttachment} = useDeleteGroupEventAttachment();

  const hasSetStatsPeriod = statsPeriod || start || end;

  const handleDelete = (attachment: IssueAttachment) => {
    deleteAttachment({
      attachment,
      projectSlug: project.slug,
      activeAttachmentsTab,
      group,
      orgSlug: organization.slug,
      cursor: cursor ?? undefined,
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
