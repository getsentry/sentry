import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import GlobalEventProcessingAlert from 'sentry/components/globalEventProcessingAlert';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconEllipsis, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {EditableIssueViewHeader} from 'sentry/views/issueList/editableIssueViewHeader';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {
  canEditIssueView,
  confirmDeleteIssueView,
  isNewViewPage,
} from 'sentry/views/issueList/issueViews/utils';
import {useDeleteGroupSearchView} from 'sentry/views/issueList/mutations/useDeleteGroupSearchView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

type LeftNavViewsHeaderProps = {
  selectedProjectIds: number[];
};

function PageTitle() {
  const organization = useOrganization();
  const location = useLocation();
  const {data: groupSearchView} = useSelectedGroupSearchView();
  const user = useUser();
  const hasIssueViewSharing = organization.features.includes('issue-view-sharing');

  if (
    hasIssueViewSharing &&
    groupSearchView &&
    canEditIssueView({groupSearchView, user})
  ) {
    return <EditableIssueViewHeader view={groupSearchView} />;
  }

  if (groupSearchView) {
    return <Layout.Title>{groupSearchView?.name ?? t('Issues')}</Layout.Title>;
  }

  if (isNewViewPage(location.pathname)) {
    return <Layout.Title>{t('New View')}</Layout.Title>;
  }

  return <Layout.Title>{t('Issues')}</Layout.Title>;
}

function IssueViewStarButton() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {data: groupSearchView} = useSelectedGroupSearchView();
  const {mutate: mutateViewStarred} = useUpdateGroupSearchViewStarred({
    onMutate: variables => {
      setApiQueryData<GroupSearchView>(
        queryClient,
        makeFetchGroupSearchViewKey({
          orgSlug: organization.slug,
          id: variables.id,
        }),
        oldGroupSearchView =>
          oldGroupSearchView
            ? {...oldGroupSearchView, starred: variables.starred}
            : oldGroupSearchView
      );
    },
    onError: (_error, variables) => {
      setApiQueryData<GroupSearchView>(
        queryClient,
        makeFetchGroupSearchViewKey({
          orgSlug: organization.slug,
          id: variables.id,
        }),
        oldGroupSearchView =>
          oldGroupSearchView
            ? {...oldGroupSearchView, starred: !variables.starred}
            : oldGroupSearchView
      );
    },
  });

  if (!organization.features.includes('issue-view-sharing') || !groupSearchView) {
    return null;
  }

  return (
    <Button
      onClick={() => {
        mutateViewStarred({
          id: groupSearchView.id,
          starred: !groupSearchView?.starred,
          view: groupSearchView,
        });
      }}
      aria-label={groupSearchView?.starred ? t('Unstar view') : t('Star view')}
      icon={
        <IconStar
          isSolid={groupSearchView?.starred}
          color={groupSearchView?.starred ? 'yellow300' : 'subText'}
        />
      }
      size="sm"
    />
  );
}

function IssueViewEditMenu() {
  const organization = useOrganization();
  const {data: groupSearchView} = useSelectedGroupSearchView();
  const user = useUser();
  const {mutate: deleteIssueView} = useDeleteGroupSearchView();
  const navigate = useNavigate();

  if (!organization.features.includes('issue-view-sharing') || !groupSearchView) {
    return null;
  }

  const canDeleteView = canEditIssueView({groupSearchView, user});

  return (
    <DropdownMenu
      items={[
        {
          key: 'delete',
          label: t('Delete View'),
          priority: 'danger',
          disabled: !canDeleteView,
          details: canDeleteView
            ? undefined
            : t('You do not have permission to delete this view.'),
          onAction: () => {
            confirmDeleteIssueView({
              handleDelete: () =>
                deleteIssueView(
                  {id: groupSearchView.id},
                  {
                    onSuccess: () => {
                      navigate(
                        normalizeUrl(`/organizations/${organization.slug}/issues/`)
                      );
                    },
                  }
                ),
              groupSearchView,
            });
          },
        },
      ]}
      trigger={props => (
        <Button
          size="sm"
          {...props}
          icon={<IconEllipsis />}
          aria-label={t('More issue view options')}
        />
      )}
      position="bottom-end"
      minMenuWidth={160}
    />
  );
}

function LeftNavViewsHeader({selectedProjectIds}: LeftNavViewsHeaderProps) {
  const {projects} = useProjects();
  const prefersStackedNav = usePrefersStackedNav();
  const selectedProjects = projects.filter(({id}) =>
    selectedProjectIds.includes(Number(id))
  );

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <StyledLayoutTitle>
          <PageTitle />
          <Actions>
            <IssueViewStarButton />
            <IssueViewEditMenu />
          </Actions>
        </StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions />
      <StyledGlobalEventProcessingAlert projects={selectedProjects} />
    </Layout.Header>
  );
}

export default LeftNavViewsHeader;

const StyledGlobalEventProcessingAlert = styled(GlobalEventProcessingAlert)`
  grid-column: 1/-1;
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-top: ${space(2)};
    margin-bottom: 0;
  }
`;

const StyledLayoutTitle = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Actions = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
