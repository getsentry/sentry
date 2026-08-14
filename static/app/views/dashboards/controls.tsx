import {Fragment, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Confirm, openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconAdd, IconCopy, IconDownload, IconEdit, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
import {EditAccessSelector} from 'sentry/views/dashboards/editAccessSelector';
import {useDuplicatePrebuiltDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';
import {useHasNewBreadcrumbs} from 'sentry/views/navigation/useHasNewBreadcrumbs';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {DashboardRevisionsButton} from './dashboardRevisions';
import {exportDashboard} from './exportDashboard';
import type {DashboardDetails, DashboardPermissions} from './types';
import {DashboardState, MAX_WIDGETS, PREBUILT_DASHBOARD_LABEL} from './types';

type Props = {
  dashboard: DashboardDetails;
  dashboardState: DashboardState;
  onAddWidget: (dataset: DataSet, openWidgetTemplates: boolean) => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  organization: Organization;
  widgetLimitReached: boolean;
  hasUnsavedFilters?: boolean;
  hideAddWidget?: boolean;
  isSaving?: boolean;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
};

export function Controls(props: Props) {
  const hasNewBreadcrumbs = useHasNewBreadcrumbs();

  if (hasNewBreadcrumbs) {
    return null;
  }

  return <LegacyDashboardControls {...props} />;
}

function LegacyDashboardControls({
  dashboardState,
  dashboard,
  hasUnsavedFilters,
  hideAddWidget = false,
  widgetLimitReached,
  onChangeEditAccess,
  onEdit,
  onCommit,
  onDelete,
  onCancel,
  onAddWidget,
  isSaving,
}: Props) {
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);
  const queryClient = useQueryClient();
  function renderCancelButton(label = t('Cancel'), variant?: 'transparent') {
    return (
      <Button
        data-test-id="dashboard-cancel"
        size="sm"
        variant={variant}
        onClick={e => {
          e.preventDefault();
          onCancel();
        }}
      >
        {label}
      </Button>
    );
  }

  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const api = useApi();
  const navigate = useNavigate();
  const {duplicatePrebuiltDashboard, isLoading: isLoadingDuplicatePrebuiltDashboard} =
    useDuplicatePrebuiltDashboard({
      onSuccess: (newDashboard: DashboardDetails) => {
        navigate(
          normalizeUrl(
            `/organizations/${organization.slug}/dashboard/${newDashboard.id}/`
          )
        );
      },
    });

  const isPrebuiltDashboard = defined(dashboard.prebuiltId);

  if ([DashboardState.EDIT, DashboardState.PENDING_DELETE].includes(dashboardState)) {
    return (
      <Fragment key="edit-controls">
        {renderCancelButton()}
        <Confirm
          priority="danger"
          message={t('Are you sure you want to delete this dashboard?')}
          onConfirm={onDelete}
        >
          <Button size="sm" data-test-id="dashboard-delete" variant="danger">
            {t('Delete')}
          </Button>
        </Confirm>
        <Button
          data-test-id="dashboard-commit"
          size="sm"
          onClick={e => {
            e.preventDefault();
            onCommit();
          }}
          variant="primary"
        >
          {t('Save and Finish')}
        </Button>
      </Fragment>
    );
  }

  if (dashboardState === DashboardState.CREATE) {
    return (
      <Fragment key="create-controls">
        {renderCancelButton()}
        <Button
          data-test-id="dashboard-commit"
          size="sm"
          onClick={e => {
            e.preventDefault();
            onCommit();
          }}
          variant="primary"
        >
          {t('Save and Finish')}
        </Button>
      </Fragment>
    );
  }

  if (dashboardState === DashboardState.PREVIEW) {
    return (
      <Fragment key="preview-controls">
        {renderCancelButton(t('Go Back'))}

        <DashboardCreateLimitWrapper>
          {({
            hasReachedDashboardLimit,
            isLoading: isLoadingDashboardsLimit,
            limitMessage,
          }) => (
            <Button
              data-test-id="dashboard-commit"
              size="sm"
              onClick={e => {
                e.preventDefault();
                onCommit();
              }}
              variant="primary"
              disabled={hasReachedDashboardLimit || isLoadingDashboardsLimit}
              tooltipProps={{
                isHoverable: true,
                title: limitMessage,
              }}
            >
              {t('Save and Finish')}
            </Button>
          )}
        </DashboardCreateLimitWrapper>
      </Fragment>
    );
  }

  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboard.permissions,
    dashboard.createdBy
  );

  return (
    <Fragment key="controls">
      <DashboardEditFeature>
        {hasFeature => (
          <Fragment>
            <Tooltip title={isFavorited ? t('Starred Dashboard') : t('Star Dashboard')}>
              <Button
                size="sm"
                aria-label={t('star-dashboard')}
                icon={
                  <IconStar
                    variant={isFavorited ? 'warning' : 'muted'}
                    isSolid={isFavorited}
                    aria-label={isFavorited ? t('Unstar') : t('Star')}
                    data-test-id={isFavorited ? 'yellow-star' : 'empty-star'}
                  />
                }
                onClick={async () => {
                  try {
                    setIsFavorited(!isFavorited);
                    await updateDashboardFavorite(
                      api,
                      queryClient,
                      organization,
                      dashboard.id,
                      !isFavorited
                    );
                    trackAnalytics('dashboards_manage.toggle_favorite', {
                      organization,
                      dashboard_id: dashboard.id,
                      favorited: !isFavorited,
                    });
                  } catch (error) {
                    // If the api call fails, revert the state
                    setIsFavorited(isFavorited);
                  }
                }}
              />
            </Tooltip>
            <Feature features="dashboards-import">
              <Tooltip title={t('Export Dashboard')}>
                <Button
                  data-test-id="dashboard-export"
                  aria-label={t('export-dashboard')}
                  onClick={e => {
                    e.preventDefault();
                    exportDashboard();
                  }}
                  icon={<IconDownload />}
                  variant="secondary"
                  size="sm"
                />
              </Tooltip>
            </Feature>
            {hasFeature &&
              (isPrebuiltDashboard ? (
                <Button
                  data-test-id="dashboard-edit"
                  aria-label={t('edit-dashboard')}
                  icon={<IconEdit />}
                  disabled
                  tooltipProps={{
                    title: tct(
                      'This is a [label] dashboard and cannot be edited. Duplicate it to make changes.',
                      {label: PREBUILT_DASHBOARD_LABEL}
                    ),
                  }}
                  variant="secondary"
                  size="sm"
                />
              ) : (
                <Button
                  data-test-id="dashboard-edit"
                  aria-label={t('edit-dashboard')}
                  onClick={e => {
                    e.preventDefault();
                    onEdit();
                  }}
                  icon={isSaving ? <LoadingIndicator size={14} /> : <IconEdit />}
                  disabled={hasUnsavedFilters || !hasEditAccess || isSaving}
                  tooltipProps={{
                    title:
                      (isSaving
                        ? DASHBOARD_SAVING_MESSAGE
                        : hasEditAccess
                          ? hasUnsavedFilters
                            ? UNSAVED_FILTERS_MESSAGE
                            : null
                          : t('You do not have permission to edit this dashboard')) ??
                      t('Edit Dashboard'),
                  }}
                  variant="secondary"
                  size="sm"
                />
              ))}
            {!isPrebuiltDashboard && (
              <EditAccessSelector
                dashboard={dashboard}
                onChangeEditAccess={onChangeEditAccess}
              />
            )}
            {hasFeature && <DashboardRevisionsButton dashboard={dashboard} />}
            {hasFeature && !isPrebuiltDashboard && !hideAddWidget && (
              <AddWidgetDropdown
                hasEditAccess={hasEditAccess}
                onAddWidget={onAddWidget}
                widgetLimitReached={widgetLimitReached}
              />
            )}
            {hasFeature && isPrebuiltDashboard && (
              <DashboardCreateLimitWrapper>
                {({
                  hasReachedDashboardLimit,
                  isLoading: isLoadingDashboardsLimit,
                  limitMessage,
                }) => {
                  const isLoading =
                    isLoadingDuplicatePrebuiltDashboard || isLoadingDashboardsLimit;
                  return (
                    <Tooltip
                      title={t('Duplicate Dashboard')}
                      disabled={isLoading || hasReachedDashboardLimit}
                    >
                      <Button
                        data-test-id="dashboard-duplicate"
                        aria-label={t('duplicate-dashboard')}
                        onClick={e => {
                          e.preventDefault();
                          openConfirmModal({
                            message: t(
                              'Are you sure you want to duplicate this dashboard?'
                            ),
                            priority: 'primary',
                            onConfirm: () => duplicatePrebuiltDashboard(dashboard.id),
                          });
                        }}
                        icon={isLoading ? <LoadingIndicator size={14} /> : <IconCopy />}
                        disabled={isLoading || hasReachedDashboardLimit}
                        tooltipProps={{title: limitMessage}}
                        variant="secondary"
                        size="sm"
                      >
                        {t('Duplicate Dashboard')}
                      </Button>
                    </Tooltip>
                  );
                }}
              </DashboardCreateLimitWrapper>
            )}
          </Fragment>
        )}
      </DashboardEditFeature>
    </Fragment>
  );
}

export function DashboardActionBar({
  dashboard,
  dashboardState,
  hideAddWidget = false,
  onAddWidget,
  onCancel,
  onChangeEditAccess,
  onCommit,
  onDelete,
  widgetLimitReached,
}: Props) {
  const hasNewBreadcrumbs = useHasNewBreadcrumbs();
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();

  if (!hasNewBreadcrumbs) {
    return null;
  }

  function handleCancel(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onCancel();
  }

  function handleCommit(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onCommit();
  }

  if ([DashboardState.EDIT, DashboardState.PENDING_DELETE].includes(dashboardState)) {
    return (
      <DashboardControls>
        <Button size="sm" onClick={handleCommit} variant="primary">
          {t('Save and Finish')}
        </Button>
        <Confirm
          priority="danger"
          message={t('Are you sure you want to delete this dashboard?')}
          onConfirm={onDelete}
        >
          <Button size="sm" variant="danger">
            {t('Delete')}
          </Button>
        </Confirm>
        <Button size="sm" variant="transparent" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
      </DashboardControls>
    );
  }

  if (dashboardState === DashboardState.CREATE) {
    return (
      <DashboardControls>
        <Button size="sm" variant="transparent" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
        <Button size="sm" onClick={handleCommit} variant="primary">
          {t('Save and Finish')}
        </Button>
      </DashboardControls>
    );
  }

  if (dashboardState === DashboardState.PREVIEW) {
    return (
      <DashboardControls>
        <Button size="sm" onClick={handleCancel}>
          {t('Go Back')}
        </Button>
        <DashboardCreateLimitWrapper>
          {({hasReachedDashboardLimit, isLoading, limitMessage}) => (
            <Button
              size="sm"
              onClick={handleCommit}
              variant="primary"
              disabled={hasReachedDashboardLimit || isLoading}
              tooltipProps={{isHoverable: true, title: limitMessage}}
            >
              {t('Save and Finish')}
            </Button>
          )}
        </DashboardCreateLimitWrapper>
      </DashboardControls>
    );
  }

  const isPrebuiltDashboard = defined(dashboard.prebuiltId);
  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboard.permissions,
    dashboard.createdBy
  );
  return (
    <DashboardEditFeature>
      {hasFeature => {
        const showAddWidget = hasFeature && !isPrebuiltDashboard && !hideAddWidget;
        const showEditAccess = !isPrebuiltDashboard;

        if (!showAddWidget && !showEditAccess) {
          return null;
        }

        return (
          <DashboardControls>
            {showAddWidget && (
              <AddWidgetDropdown
                hasEditAccess={hasEditAccess}
                onAddWidget={onAddWidget}
                widgetLimitReached={widgetLimitReached}
              />
            )}
            {showEditAccess && (
              <EditAccessSelector
                dashboard={dashboard}
                onChangeEditAccess={onChangeEditAccess}
              />
            )}
          </DashboardControls>
        );
      }}
    </DashboardEditFeature>
  );
}

function AddWidgetDropdown({
  hasEditAccess,
  onAddWidget,
  widgetLimitReached,
}: Pick<Props, 'onAddWidget' | 'widgetLimitReached'> & {hasEditAccess: boolean}) {
  const items: MenuItemProps[] = [
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidget(DataSet.ERRORS, false),
    },
    {
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidget(DataSet.ERRORS, true),
    },
  ];
  const tooltip = hasEditAccess
    ? widgetLimitReached
      ? tct('Max widgets ([maxWidgets]) per dashboard reached.', {
          maxWidgets: MAX_WIDGETS,
        })
      : null
    : t('You do not have permission to edit this dashboard');

  return (
    <DropdownMenu
      items={items}
      isDisabled={widgetLimitReached || !hasEditAccess}
      triggerLabel={t('Add Widget')}
      triggerProps={{
        'aria-label': t('Add Widget'),
        size: 'sm',
        showChevron: true,
        icon: <IconAdd size="sm" />,
        tooltipProps: {title: tooltip},
        variant: 'primary',
      }}
      position="bottom-end"
    />
  );
}

function DashboardControls({children}: {children: React.ReactNode}) {
  return (
    <Flex
      as="section"
      aria-label={t('Dashboard controls')}
      align="center"
      background="primary"
      borderTop="primary"
      gap="md"
      padding="lg xl xl"
      width="100%"
      wrap="wrap"
    >
      {children}
    </Flex>
  );
}

function DashboardEditFeature({
  children,
}: {
  children: (hasFeature: boolean) => React.ReactNode;
}) {
  const renderDisabled = (p: any) => (
    <Hovercard
      body={
        <FeatureDisabled
          features={p.features}
          hideHelpToggle
          featureName={t('Dashboard Editing')}
        />
      }
    >
      {p.children(p)}
    </Hovercard>
  );

  return (
    <Feature
      overrideName="feature-disabled:dashboards-edit"
      features="organizations:dashboards-edit"
      renderDisabled={renderDisabled}
    >
      {({hasFeature}) => children(hasFeature)}
    </Feature>
  );
}
