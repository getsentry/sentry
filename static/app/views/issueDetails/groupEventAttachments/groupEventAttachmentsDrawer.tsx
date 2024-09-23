import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {
  CrumbContainer,
  EventDrawerBody,
  EventDrawerContainer,
  EventDrawerHeader,
  EventNavigator,
  Header,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import LoadingError from 'sentry/components/loadingError';
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
import {useDeleteGroupEventAttachment} from './useDeleteGroupEventAttachment';
import {useGroupEventAttachments} from './useGroupEventAttachments';

type GroupEventAttachmentsProps = {
  groupId: string;
  project: Project;
};

export function GroupEventAttachmentsDrawer({
  project,
  groupId,
}: GroupEventAttachmentsProps) {
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

  return (
    <EventDrawerContainer>
      <EventDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{groupId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: t('Attachments')},
          ]}
        />
      </EventDrawerHeader>
      <EventNavigator>
        <Header>{t('Attachments')}</Header>
        <GroupEventAttachmentsFilter project={project} />
      </EventNavigator>
      <EventDrawerBody>
        <Wrapper>
          {/* TODO(issue-details-streamline): Bring back a grid for screenshots */}
          {renderAttachmentsTable()}
          <NoMarginPagination pageLinks={getResponseHeader?.('Link')} />
        </Wrapper>
      </EventDrawerBody>
    </EventDrawerContainer>
  );
}

const NoMarginPagination = styled(Pagination)`
  margin: 0;
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;
