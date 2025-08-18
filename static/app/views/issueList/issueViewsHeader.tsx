import type {ReactNode} from 'react';
import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconEllipsis, IconPause, IconPlay, IconRefresh, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
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
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

type IssueViewsHeaderProps = {
  onRealtimeChange: (active: boolean) => void;
  realtimeActive: boolean;
  selectedProjectIds: number[];
  title: ReactNode;
  backgroundRefreshing?: boolean;
  description?: ReactNode;
  headerActions?: ReactNode;
  manualRefresh?: () => void;
  refetchGroups?: () => void;
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
  const prefersStackedNav = usePrefersStackedNav();

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

  if (!prefersStackedNav || !groupSearchView) {
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
  const {mutateAsync: deleteIssueView} = useDeleteGroupSearchView();
  const navigate = useNavigate();
  const prefersStackedNav = usePrefersStackedNav();

  if (!prefersStackedNav || !groupSearchView) {
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
  headerActions,
  onRealtimeChange,
  realtimeActive,
  refetchGroups,
  manualRefresh,
  backgroundRefreshing,
}: IssueViewsHeaderProps) {
  const prefersStackedNav = usePrefersStackedNav();
  const organization = useOrganization();

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState(false);
  const refreshInterval = 10000; // Fixed 10 seconds interval

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh || !refetchGroups) return;

    const interval = setInterval(() => {
      refetchGroups();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, refetchGroups]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(() => {
    if (manualRefresh) {
      manualRefresh();
      trackAnalytics('issues_stream.manual_refresh.clicked', {
        organization,
        enabled: true,
      });
    }
  }, [manualRefresh, organization]);

  // Auto-refresh toggle handler
  const handleAutoRefreshToggle = useCallback(() => {
    const newAutoRefresh = !autoRefresh;
    setAutoRefresh(newAutoRefresh);

    if (newAutoRefresh) {
      trackAnalytics('issues_stream.auto_refresh.enabled', {
        organization,
        enabled: true,
      });
    } else {
      trackAnalytics('issues_stream.auto_refresh.disabled', {
        organization,
        enabled: false,
      });
    }
  }, [autoRefresh, organization]);

  const realtimeTitle = realtimeActive
    ? t('Pause real-time updates')
    : t('Enable real-time updates');

  return (
    <Layout.Header noActionWrap unified={prefersStackedNav}>
      <Layout.HeaderContent unified={prefersStackedNav}>
        <StyledLayoutTitle>
          <PageTitle title={title} description={description} />
          <Actions>
            {headerActions}
            <IssueViewStarButton />
            <IssueViewEditMenu />
          </Actions>
        </StyledLayoutTitle>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar>
          {/* Refresh Controls */}
          {refetchGroups && (
            <React.Fragment>
              {backgroundRefreshing && (
                <div style={{fontSize: '12px', color: '#6b7280', marginRight: '8px'}}>
                  {t('Refreshing...')}
                </div>
              )}
              <Tooltip
                title={autoRefresh ? t('Pause auto-refresh') : t('Start auto-refresh')}
              >
                <Button
                  size="sm"
                  onClick={handleAutoRefreshToggle}
                  icon={autoRefresh ? <IconPause /> : <IconPlay />}
                  aria-label={
                    autoRefresh ? t('Pause auto-refresh') : t('Start auto-refresh')
                  }
                  priority="default"
                  style={autoRefresh ? {border: '2px solid #7c3aed'} : {}}
                />
              </Tooltip>
              <Tooltip title={t('Refresh issue list now')}>
                <Button
                  size="sm"
                  onClick={handleManualRefresh}
                  icon={<IconRefresh />}
                  aria-label={t('Refresh')}
                  priority="default"
                  disabled={backgroundRefreshing}
                />
              </Tooltip>
            </React.Fragment>
          )}
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export default IssueViewsHeader;

const StyledLayoutTitle = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const Actions = styled('div')`
  align-items: center;
  display: flex;
  gap: ${space(1)};
`;

const LeftAlignContainer = styled('div')`
  text-align: left;
`;
