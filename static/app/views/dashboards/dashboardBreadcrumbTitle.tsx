import {useState, type ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import {openConfirmModal} from 'sentry/components/confirm';
import {
  IconClock,
  IconCopy,
  IconDownload,
  IconEllipsis,
  IconGroup,
  IconInput,
  IconStar,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {defined} from 'sentry/utils/defined';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {useOpenDashboardRevisions} from 'sentry/views/dashboards/dashboardRevisions';
import {useOpenEditAccessModal} from 'sentry/views/dashboards/editAccessModal';
import {exportDashboard} from 'sentry/views/dashboards/exportDashboard';
import {useDuplicateDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {useOpenRenameDashboardModal} from 'sentry/views/dashboards/renameDashboardModal';
import type {DashboardDetails, DashboardPermissions} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';

/**
 * Star/unstar the dashboard. Sits beside the actions menu rather than inside it —
 * starring is a frequent, cheaply reversible action, so burying it a click deep
 * made it hard to find.
 *
 * Presentational on purpose: the starred state has to live in the parent, which
 * stays mounted while this button does not (see `isFavorited` below).
 */
function DashboardFavoriteButton({
  isFavorited,
  onToggle,
}: {
  isFavorited: boolean | undefined;
  onToggle: () => void;
}) {
  const label = isFavorited ? t('Unstar') : t('Star');

  return (
    <Button
      size="zero"
      variant="transparent"
      aria-label={label}
      tooltipProps={{title: label}}
      // Unstarred deliberately inherits the button's colour instead of going
      // `muted` like the table-row stars do. This one sits directly beside the
      // ellipsis trigger, which inherits too, so a dimmer star reads as a
      // rendering bug next to its neighbour.
      icon={
        <IconStar isSolid={isFavorited} variant={isFavorited ? 'warning' : undefined} />
      }
      onClick={onToggle}
    />
  );
}

interface DashboardBreadcrumbTitleProps {
  dashboard: DashboardDetails;
  isPreview: boolean;
  /**
   * Called with the committed title once a rename succeeds. The modal has
   * already persisted it for a saved dashboard; this keeps the page's own copy
   * — and any edit session in progress — in step.
   */
  onRename: (title: string) => void;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
}

function DashboardTitle({
  canRename,
  dashboard,
  duplicateDashboard,
  duplicateDisabledReason = null,
  isDuplicateDisabled = false,
  isFavorited,
  isPersisted,
  isPrebuiltDashboard,
  canViewRevisions,
  onToggleFavorite,
  openDashboardRevisions,
  openEditAccess,
  openRename,
  organization,
}: {
  canRename: boolean;
  canViewRevisions: boolean;
  dashboard: DashboardDetails;
  duplicateDashboard: ReturnType<typeof useDuplicateDashboard>;
  isFavorited: boolean | undefined;
  isPersisted: boolean;
  isPrebuiltDashboard: boolean;
  onToggleFavorite: () => void;
  openDashboardRevisions: () => void;
  openEditAccess: () => void;
  openRename: () => void;
  organization: Organization;
  duplicateDisabledReason?: ReactNode;
  isDuplicateDisabled?: boolean;
}) {
  const renameItem = {
    key: 'rename',
    label: t('Rename'),
    leadingItems: <IconInput />,
    onAction: openRename,
  };
  const revisionItem = {
    key: 'revisions',
    label: t('Show version history'),
    leadingItems: <IconClock />,
    onAction: openDashboardRevisions,
  };
  const permissionsItem = {
    key: 'edit-access',
    label: t('View Permissions'),
    leadingItems: <IconGroup />,
    onAction: openEditAccess,
  };
  const exportItem = {
    key: 'export',
    label: t('Export'),
    leadingItems: <IconDownload />,
    onAction: exportDashboard,
  };
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
  // A dashboard that has not been saved yet has no id, and every action here
  // but renaming needs one — `exportDashboard` even reads the id back out of
  // the URL, which on /dashboards/new/ has none to find.
  const menuItems = [
    ...(canRename ? [renameItem] : []),
    ...(isPrebuiltDashboard ? [duplicateItem] : []),
    ...(isPrebuiltDashboard || !isPersisted ? [] : [permissionsItem]),
    ...(canViewRevisions ? [revisionItem] : []),
    ...(organization.features.includes('dashboards-import') && isPersisted
      ? [exportItem]
      : []),
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
          isPersisted
            ? {
                type: 'button',
                element: (
                  <DashboardFavoriteButton
                    isFavorited={isFavorited}
                    onToggle={onToggleFavorite}
                  />
                ),
              }
            : null,
        ],
      }}
    />
  );
}

export function DashboardBreadcrumbTitle({
  dashboard,
  isPreview,
  onRename,
  onChangeEditAccess,
}: DashboardBreadcrumbTitleProps) {
  // Lives here rather than in `DashboardFavoriteButton` because the button
  // unmounts while previewing, and a toggle never writes back to
  // `dashboard.isFavorited` — remounting from the prop would revert the star.
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const organization = useOrganization();
  const openDashboardRevisions = useOpenDashboardRevisions(dashboard);
  const openEditAccess = useOpenEditAccessModal(dashboard, onChangeEditAccess);
  const openRename = useOpenRenameDashboardModal(dashboard, onRename, 'details');
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const duplicateDashboard = useDuplicateDashboard({
    onSuccess: newDashboard => {
      navigate(
        normalizeUrl(`/organizations/${organization.slug}/dashboard/${newDashboard.id}/`)
      );
    },
  });

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

  const isPrebuiltDashboard = defined(dashboard.prebuiltId);
  // A prebuilt dashboard's title is fixed — the backend rejects a change to it.
  const canRename =
    !isPrebuiltDashboard &&
    checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboard.permissions,
      dashboard.createdBy
    );
  const isPersisted = Boolean(dashboard.id);
  const canViewRevisions =
    Boolean(dashboard.id) &&
    !isPrebuiltDashboard &&
    organization.features.includes('dashboards-edit');
  const handleToggleFavorite = async () => {
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
  };
  if (!isPrebuiltDashboard) {
    return (
      <DashboardTitle
        canRename={canRename}
        canViewRevisions={canViewRevisions}
        dashboard={dashboard}
        duplicateDashboard={duplicateDashboard}
        isFavorited={isFavorited}
        isPersisted={isPersisted}
        isPrebuiltDashboard={isPrebuiltDashboard}
        onToggleFavorite={handleToggleFavorite}
        openDashboardRevisions={openDashboardRevisions}
        openEditAccess={openEditAccess}
        openRename={openRename}
        organization={organization}
      />
    );
  }

  return (
    <DashboardCreateLimitWrapper>
      {({hasReachedDashboardLimit, isLoading, limitMessage}) => (
        <DashboardTitle
          canRename={canRename}
          canViewRevisions={canViewRevisions}
          dashboard={dashboard}
          duplicateDashboard={duplicateDashboard}
          duplicateDisabledReason={limitMessage}
          isDuplicateDisabled={hasReachedDashboardLimit || isLoading}
          isFavorited={isFavorited}
          isPersisted={isPersisted}
          isPrebuiltDashboard={isPrebuiltDashboard}
          onToggleFavorite={handleToggleFavorite}
          openDashboardRevisions={openDashboardRevisions}
          openEditAccess={openEditAccess}
          openRename={openRename}
          organization={organization}
        />
      )}
    </DashboardCreateLimitWrapper>
  );
}
