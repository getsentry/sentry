import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd, IconCopy, IconDownload, IconEdit, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {DASHBOARD_SAVING_MESSAGE} from 'sentry/views/dashboards/constants';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import EditAccessSelector from 'sentry/views/dashboards/editAccessSelector';
import {useDuplicatePrebuiltDashboard} from 'sentry/views/dashboards/hooks/useDuplicateDashboard';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import {UNSAVED_FILTERS_MESSAGE} from './detail';
import exportDashboard from './exportDashboard';
import type {DashboardDetails, DashboardListItem, DashboardPermissions} from './types';
import {DashboardState, MAX_WIDGETS} from './types';

type Props = {
  dashboard: DashboardDetails;
  dashboardState: DashboardState;
  dashboards: DashboardListItem[];
  onAddWidget: (dataset: DataSet, openWidgetTemplates: boolean) => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  organization: Organization;
  widgetLimitReached: boolean;
  hasUnsavedFilters?: boolean;
  isSaving?: boolean;
  onChangeEditAccess?: (newDashboardPermissions: DashboardPermissions) => void;
};

function Controls({
  dashboardState,
  dashboard,
  dashboards,
  hasUnsavedFilters,
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
  function renderCancelButton(label = t('Cancel')) {
    return (
      <Button
        data-test-id="dashboard-cancel"
        size="sm"
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
  const hasPrebuiltControlsFeature = organization.features.includes(
    'dashboards-prebuilt-controls'
  );

  const {duplicatePrebuiltDashboard, isLoading: isLoadingDuplicatePrebuiltDashboard} =
    useDuplicatePrebuiltDashboard({
      onSuccess: (newDashboard: DashboardDetails) => {
        navigate(`/organizations/${organization.slug}/dashboard/${newDashboard.id}/`);
      },
    });

  const isPrebuiltDashboard = defined(dashboard.prebuiltId);

  if (isPrebuiltDashboard && !hasPrebuiltControlsFeature) {
    return null;
  }

  if ([DashboardState.EDIT, DashboardState.PENDING_DELETE].includes(dashboardState)) {
    return (
      <StyledButtonBar key="edit-controls">
        {renderCancelButton()}
        <Confirm
          priority="danger"
          message={t('Are you sure you want to delete this dashboard?')}
          onConfirm={onDelete}
          disabled={dashboards.length <= 1}
        >
          <Button size="sm" data-test-id="dashboard-delete" priority="danger">
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
          priority="primary"
        >
          {t('Save and Finish')}
        </Button>
      </StyledButtonBar>
    );
  }

  if (dashboardState === DashboardState.CREATE) {
    return (
      <StyledButtonBar key="create-controls">
        {renderCancelButton()}
        <Button
          data-test-id="dashboard-commit"
          size="sm"
          onClick={e => {
            e.preventDefault();
            onCommit();
          }}
          priority="primary"
        >
          {t('Save and Finish')}
        </Button>
      </StyledButtonBar>
    );
  }

  if (dashboardState === DashboardState.PREVIEW) {
    return (
      <StyledButtonBar key="preview-controls">
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
              priority="primary"
              disabled={hasReachedDashboardLimit || isLoadingDashboardsLimit}
              title={limitMessage}
              tooltipProps={{
                isHoverable: true,
              }}
            >
              {t('Add Dashboard')}
            </Button>
          )}
        </DashboardCreateLimitWrapper>
      </StyledButtonBar>
    );
  }

  const defaultDataset = DataSet.ERRORS;

  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboard.permissions,
    dashboard.createdBy
  );

  const addWidgetDropdownItems: MenuItemProps[] = [
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidget(defaultDataset, false),
    },
    {
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidget(defaultDataset, true),
    },
  ];

  const tooltipMessage = hasEditAccess
    ? widgetLimitReached
      ? tct('Max widgets ([maxWidgets]) per dashboard reached.', {
          maxWidgets: MAX_WIDGETS,
        })
      : null
    : t('You do not have permission to edit this dashboard');

  const renderEditButton = (hasFeature: boolean) => {
    if (!hasFeature) {
      return null;
    }
    if (isPrebuiltDashboard) {
      return null;
    }
    const isDisabled = !hasFeature || hasUnsavedFilters || !hasEditAccess || isSaving;
    const toolTipMessage = isSaving
      ? DASHBOARD_SAVING_MESSAGE
      : hasEditAccess
        ? hasUnsavedFilters
          ? UNSAVED_FILTERS_MESSAGE
          : null
        : t('You do not have permission to edit this dashboard');

    return (
      <Tooltip title={t('Edit Dashboard')} disabled={isDisabled}>
        <Button
          data-test-id="dashboard-edit"
          aria-label={t('edit-dashboard')}
          onClick={e => {
            e.preventDefault();
            onEdit();
          }}
          icon={isSaving ? <LoadingIndicator size={14} /> : <IconEdit />}
          disabled={isDisabled}
          title={toolTipMessage}
          priority="default"
          size="sm"
        />
      </Tooltip>
    );
  };

  return (
    <StyledButtonBar key="controls">
      <DashboardEditFeature>
        {hasFeature => (
          <Fragment>
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
                  priority="default"
                  size="sm"
                />
              </Tooltip>
            </Feature>
            {dashboard.id !== 'default-overview' && !isPrebuiltDashboard && (
              <EditAccessSelector
                dashboard={dashboard}
                onChangeEditAccess={onChangeEditAccess}
              />
            )}
            {dashboard.id !== 'default-overview' && (
              <Tooltip title={isFavorited ? t('Starred Dashboard') : t('Star Dashboard')}>
                <Button
                  size="sm"
                  aria-label={t('star-dashboard')}
                  icon={
                    <IconStar
                      color={isFavorited ? 'yellow300' : 'gray500'}
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
            )}
            {renderEditButton(hasFeature)}
            {hasFeature && !isPrebuiltDashboard && (
              <Tooltip
                title={tooltipMessage}
                disabled={!widgetLimitReached && hasEditAccess}
              >
                <DropdownMenu
                  items={addWidgetDropdownItems}
                  isDisabled={widgetLimitReached || !hasEditAccess}
                  triggerLabel={t('Add Widget')}
                  triggerProps={{
                    'aria-label': t('Add Widget'),
                    size: 'sm',
                    showChevron: true,
                    icon: <IconAdd size="sm" />,
                    priority: 'primary',
                  }}
                  position="bottom-end"
                />
              </Tooltip>
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
                            onConfirm: () =>
                              duplicatePrebuiltDashboard(dashboard.prebuiltId),
                          });
                        }}
                        icon={isLoading ? <LoadingIndicator size={14} /> : <IconCopy />}
                        disabled={isLoading || hasReachedDashboardLimit}
                        title={limitMessage}
                        priority="default"
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
    </StyledButtonBar>
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
      hookName="feature-disabled:dashboards-edit"
      features="organizations:dashboards-edit"
      renderDisabled={renderDisabled}
    >
      {({hasFeature}) => children(hasFeature)}
    </Feature>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-auto-flow: row;
    grid-row-gap: ${space(1)};
    width: 100%;
  }
`;

export default Controls;
