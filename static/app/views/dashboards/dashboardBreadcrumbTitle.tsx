import {useState, type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {
  IconClock,
  IconCopy,
  IconDownload,
  IconEdit,
  IconEllipsis,
  IconStar,
} from 'sentry/icons';
import {t} from 'sentry/locale';
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
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useOpenDashboardRevisions} from 'sentry/views/dashboards/dashboardRevisions';
import {exportDashboard} from 'sentry/views/dashboards/exportDashboard';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import type {DashboardDetails} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';

interface DashboardBreadcrumbTitleProps {
  dashboard: DashboardDetails;
  hasUnsavedFilters: boolean;
  isEditing: boolean;
  isPreview: boolean;
  isSaving: boolean;
  onChange: (title: string) => void;
  onEdit: () => void;
}

export function DashboardBreadcrumbTitle({
  dashboard,
  hasUnsavedFilters,
  isEditing,
  isPreview,
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

  if (isPreview) {
    return (
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: dashboard.title,
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
  const canViewRevisions =
    Boolean(dashboard.id) &&
    !isPrebuiltDashboard &&
    organization.features.includes('dashboards-edit');
  const favoriteItem = {
    key: 'favorite',
    label: isFavorited ? t('Unstar') : t('Star'),
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
  const revisionItem = {
    key: 'revisions',
    label: t('Show version history'),
    leadingItems: <IconClock />,
    onAction: openDashboardRevisions,
  };
  const editItem = {
    key: 'dashboard-edit',
    label: t('Edit'),
    leadingItems: <IconEdit />,
    disabled: hasUnsavedFilters || isSaving,
    tooltip: isSaving
      ? DASHBOARD_SAVING_MESSAGE
      : hasUnsavedFilters
        ? UNSAVED_FILTERS_MESSAGE
        : null,
    onAction: onEdit,
  };
  const exportItem = {
    key: 'export',
    label: t('Export'),
    leadingItems: <IconDownload />,
    onAction: exportDashboard,
  };
  function renderTitle(
    isDuplicateDisabled = false,
    duplicateDisabledReason: ReactNode = null
  ) {
    const duplicateItem: MenuItemProps = {
      key: 'duplicate',
      label: t('Duplicate'),
      leadingItems: <IconCopy />,
      disabled: isDuplicateDisabled,
      tooltip: isDuplicateDisabled ? duplicateDisabledReason : null,
      onAction: () => {
        openConfirmModal({
          message: t('Are you sure you want to duplicate this dashboard?'),
          onConfirm: () => duplicateDashboard(dashboard, 'details'),
        });
      },
    };
    const menuItems = [
      favoriteItem,
      ...(canViewRevisions ? [revisionItem] : []),
      ...(isDashboardEditor ? [editItem] : []),
      ...(isPrebuiltDashboard ? [duplicateItem] : []),
      ...(organization.features.includes('dashboards-import') ? [exportItem] : []),
    ];

    return (
      <BreadcrumbList.Title
        item={{
          type: 'page-title',
          label: dashboard.title,
          trailingActions: {
            type: 'menu',
            triggerLabel: t('Dashboard actions'),
            triggerIcon: <IconEllipsis />,
            items: menuItems,
          },
        }}
      />
    );
  }

  if (!isPrebuiltDashboard) {
    return renderTitle();
  }

  return (
    <DashboardCreateLimitWrapper>
      {({hasReachedDashboardLimit, isLoading, limitMessage}) =>
        renderTitle(hasReachedDashboardLimit || isLoading, limitMessage)
      }
    </DashboardCreateLimitWrapper>
  );
}
