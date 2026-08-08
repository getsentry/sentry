import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import {openConfirmModal} from 'sentry/components/confirm';
import {IconClock, IconCopy, IconEdit, IconEllipsis, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {
  DASHBOARD_SAVING_MESSAGE,
  UNSAVED_FILTERS_MESSAGE,
} from 'sentry/views/dashboards/constants';
import {useOpenDashboardRevisions} from 'sentry/views/dashboards/dashboardRevisions';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {PREBUILT_DASHBOARD_LABEL} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';

interface DashboardBreadcrumbTitleProps {
  dashboard: DashboardDetails;
  hasUnsavedFilters: boolean;
  isEditing: boolean;
  isSaving: boolean;
  onChange: (title: string) => void;
  onEdit: () => void;
}

export function DashboardBreadcrumbTitle({
  dashboard,
  hasUnsavedFilters,
  isEditing,
  isSaving,
  onChange,
  onEdit,
}: DashboardBreadcrumbTitleProps) {
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const openDashboardRevisions = useOpenDashboardRevisions(dashboard);
  const duplicateDashboard = useDuplicateDashboard({
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
  const isDashboardEditor = hasEditAccess && !isPrebuiltDashboard;
  const editDisabled =
    isPrebuiltDashboard || !hasEditAccess || hasUnsavedFilters || isSaving;
  const editTooltip = isPrebuiltDashboard
    ? tct(
        'This is a [label] dashboard and cannot be edited. Duplicate it to make changes.',
        {label: PREBUILT_DASHBOARD_LABEL}
      )
    : hasEditAccess
      ? isSaving
        ? DASHBOARD_SAVING_MESSAGE
        : hasUnsavedFilters
          ? UNSAVED_FILTERS_MESSAGE
          : undefined
      : t('You do not have permission to edit this dashboard');
  const editItem = {
    key: 'edit',
    label: t('Edit Dashboard'),
    leadingItems: <IconEdit />,
    onAction: onEdit,
    disabled: editDisabled,
    tooltip: editTooltip,
  };
  const favoriteItem = {
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
  };
  const revisionItem = isPrebuiltDashboard
    ? null
    : {
        key: 'revisions',
        label: t('Dashboard Revisions'),
        leadingItems: <IconClock />,
        onAction: openDashboardRevisions,
      };
  const duplicateItem = isDashboardEditor
    ? null
    : {
        key: 'duplicate',
        label: t('Duplicate Dashboard'),
        leadingItems: <IconCopy />,
        onAction: () => {
          openConfirmModal({
            message: t('Are you sure you want to duplicate this dashboard?'),
            priority: 'primary',
            onConfirm: () => duplicateDashboard(dashboard, 'detail'),
          });
        },
      };
  const menuItems = [favoriteItem, revisionItem, editItem, duplicateItem].filter(
    item => item !== null
  );

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
