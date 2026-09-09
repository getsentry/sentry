import {useState, type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';

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

/**
 * Star/unstar the dashboard. Sits beside the actions menu rather than inside it —
 * starring is a frequent, cheaply reversible action, so burying it a click deep
 * made it hard to find.
 */
function DashboardFavoriteButton({dashboard}: {dashboard: DashboardDetails}) {
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);
  const api = useApi();
  const queryClient = useQueryClient();
  const organization = useOrganization();

  const label = isFavorited ? t('Unstar') : t('Star');

  return (
    <Button
      size="zero"
      variant="transparent"
      aria-label={label}
      tooltipProps={{title: label}}
      icon={
        <IconStar isSolid={isFavorited} variant={isFavorited ? 'warning' : 'muted'} />
      }
      onClick={async () => {
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
      }}
    />
  );
}

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
  const navigate = useNavigate();
  const organization = useOrganization();
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
          trailingActions: [
            // Starring used to be the one item every dashboard had, so the menu
            // was unconditional. Now that it has moved out, hide the trigger
            // when nothing is left to put behind it.
            menuItems.length > 0
              ? {
                  type: 'menu',
                  triggerLabel: t('Dashboard actions'),
                  triggerIcon: <IconEllipsis />,
                  items: menuItems,
                }
              : null,
            {type: 'button', element: <DashboardFavoriteButton dashboard={dashboard} />},
          ],
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
