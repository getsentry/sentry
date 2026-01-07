import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import DisableInDemoMode from 'sentry/components/acl/demoModeDisabled';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconEllipsis, IconPause, IconPlay, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {EditableIssueViewHeader} from 'sentry/views/issueList/editableIssueViewHeader';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {
  canEditIssueView,
  confirmDeleteIssueView,
} from 'sentry/views/issueList/issueViews/utils';
import {useDeleteGroupSearchView} from 'sentry/views/issueList/mutations/useDeleteGroupSearchView';
import {useUpdateGroupSearchViewStarred} from 'sentry/views/issueList/mutations/useUpdateGroupSearchViewStarred';
import {makeFetchGroupSearchViewKey} from 'sentry/views/issueList/queries/useFetchGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {useHasIssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/useHasIssueViews';

type IssueViewsHeaderProps = {
  onRealtimeChange: (active: boolean) => void;
  realtimeActive: boolean;
  selectedProjectIds: number[];
  title: ReactNode;
  description?: ReactNode;
  headerActions?: ReactNode;
};

function PageTitle({title, description}: {title: ReactNode; description?: ReactNode}) {
  const organization = useOrganization();
  const {data: groupSearchView} = useSelectedGroupSearchView();
  const user = useUser();
  const hasIssueViews = useHasIssueViews();

  if (
    groupSearchView &&
    hasIssueViews &&
    canEditIssueView({groupSearchView, user, organization})
  ) {
    return <EditableIssueViewHeader view={groupSearchView} />;
  }

  if (groupSearchView) {
    return <Layout.Title>{groupSearchView?.name ?? title}</Layout.Title>;
  }

  return (
    <Layout.Title>
      {title}
      {description && (
        <QuestionTooltip
          isHoverable
          position="right"
          size="sm"
          title={<LeftAlignContainer>{description}</LeftAlignContainer>}
        />
      )}
    </Layout.Title>
  );
}

function IssueViewStarButton() {
  const organization = useOrganization();
  const user = useUser();
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

  if (!groupSearchView) {
    return null;
  }

  return (
    <Button
      onClick={() => {
        mutateViewStarred(
          {
            id: groupSearchView.id,
            starred: !groupSearchView?.starred,
            view: groupSearchView,
          },
          {
            onSuccess: () => {
              trackAnalytics('issue_views.star_view', {
                organization,
                ownership:
                  user?.id === groupSearchView.createdBy?.id
                    ? 'personal'
                    : 'organization',
                starred: !groupSearchView?.starred,
                surface: 'issue-view-details',
              });
            },
          }
        );
      }}
      aria-label={groupSearchView?.starred ? t('Unstar view') : t('Star view')}
      icon={
        <IconStar
          isSolid={groupSearchView?.starred}
          variant={groupSearchView?.starred ? 'warning' : 'muted'}
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
  const {mutateAsync: deleteIssueView} = useDeleteGroupSearchView();
  const navigate = useNavigate();

  if (!groupSearchView) {
    return null;
  }

  const canDeleteView = canEditIssueView({groupSearchView, organization, user});

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
                      trackAnalytics('issue_views.delete_view', {
                        organization,
                        ownership:
                          user?.id === groupSearchView.createdBy?.id
                            ? 'personal'
                            : 'organization',
                        surface: 'issue-view-details',
                      });
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

function IssueViewsHeader({
  title,
  description,
  realtimeActive,
  onRealtimeChange,
  headerActions,
}: IssueViewsHeaderProps) {
  const {viewId} = useParams<{viewId?: string}>();

  const realtimeLabel = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  return (
    <Layout.Header noActionWrap unified>
      <Layout.HeaderContent unified>
        <Flex justify="between">
          <PageTitle title={title} description={description} />
          <Flex align="center" gap="md">
            {headerActions}
            {!viewId && (
              <DisableInDemoMode>
                <Button
                  size="sm"
                  title={realtimeLabel}
                  aria-label={realtimeLabel}
                  icon={realtimeActive ? <IconPause /> : <IconPlay />}
                  onClick={() => onRealtimeChange(!realtimeActive)}
                />
              </DisableInDemoMode>
            )}
            <IssueViewStarButton />
            <IssueViewEditMenu />
          </Flex>
        </Flex>
      </Layout.HeaderContent>
      <Layout.HeaderActions />
    </Layout.Header>
  );
}

export default IssueViewsHeader;

const LeftAlignContainer = styled('div')`
  text-align: left;
`;
