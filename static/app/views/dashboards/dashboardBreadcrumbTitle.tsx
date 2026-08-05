import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import {openConfirmModal} from 'sentry/components/confirm';
import {IconClock, IconCopy, IconEllipsis, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {useOpenDashboardRevisions} from 'sentry/views/dashboards/dashboardRevisions';
import {useDuplicatePrebuiltDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';

interface DashboardBreadcrumbTitleProps {
  dashboard: DashboardDetails;
  isEditing: boolean;
  onChange: (title: string) => void;
}

export function DashboardBreadcrumbTitle({
  dashboard,
  isEditing,
  onChange,
}: DashboardBreadcrumbTitleProps) {
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const openDashboardRevisions = useOpenDashboardRevisions(dashboard);
  const {duplicatePrebuiltDashboard} = useDuplicatePrebuiltDashboard({
    onSuccess: newDashboard => {
      navigate(
        normalizeUrl(`/organizations/${organization.slug}/dashboard/${newDashboard.id}/`)
      );
    },
  });

  if (isEditing) {
    return (
      <BreadcrumbList.Title
        item={{
          type: 'editable-title',
          value: dashboard.title,
          onChange,
          isDisabled: false,
          errorMessage: t('Please set a title for this dashboard'),
          autoSelect: true,
          'aria-label': t('Edit Dashboard Name'),
        }}
      />
    );
  }

  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboard.permissions,
    dashboard.createdBy
  );
  const isPrebuiltDashboard = defined(dashboard.prebuiltId);
  const menuItems = hasEditAccess
    ? [
        {
          key: 'favorite',
          label: isFavorited ? t('Unstar Dashboard') : t('Star Dashboard'),
          leadingItems: <IconStar isSolid={isFavorited} />,
          onAction: async () => {
            const nextIsFavorited = !isFavorited;
            setIsFavorited(nextIsFavorited);
            try {
              await updateDashboardFavorite(
                api,
                queryClient,
                organization,
                dashboard.id,
                nextIsFavorited
              );
              trackAnalytics('dashboards_manage.toggle_favorite', {
                organization,
                dashboard_id: dashboard.id,
                favorited: nextIsFavorited,
              });
            } catch {
              setIsFavorited(isFavorited);
            }
          },
        },
        isPrebuiltDashboard
          ? null
          : {
              key: 'revisions',
              label: t('Dashboard Revisions'),
              leadingItems: <IconClock />,
              onAction: openDashboardRevisions,
            },
      ].filter(item => item !== null)
    : isPrebuiltDashboard
      ? [
          {
            key: 'duplicate',
            label: t('Duplicate Dashboard'),
            leadingItems: <IconCopy />,
            onAction: () => {
              openConfirmModal({
                message: t('Are you sure you want to duplicate this dashboard?'),
                priority: 'primary',
                onConfirm: () => duplicatePrebuiltDashboard(dashboard.id),
              });
            },
          },
        ]
      : [];

  return (
    <BreadcrumbList.Title
      item={{
        type: 'page-title',
        label: dashboard.title,
        trailingActions:
          menuItems.length > 0
            ? {
                type: 'menu',
                triggerLabel: t('Dashboard actions'),
                triggerIcon: <IconEllipsis />,
                items: menuItems,
              }
            : undefined,
      }}
    />
  );
}
