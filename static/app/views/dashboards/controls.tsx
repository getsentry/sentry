import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {updateDashboardFavorite} from 'sentry/actionCreators/dashboards';
import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {Hovercard} from 'sentry/components/hovercard';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconDownload, IconEdit, IconStar} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {AddWidgetButton} from 'sentry/views/dashboards/addWidget';
import EditAccessSelector from 'sentry/views/dashboards/editAccessSelector';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

import {checkUserHasEditAccess, UNSAVED_FILTERS_MESSAGE} from './detail';
import exportDashboard from './exportDashboard';
import type {DashboardDetails, DashboardListItem, DashboardPermissions} from './types';
import {DashboardState, MAX_WIDGETS} from './types';

type Props = {
  dashboard: DashboardDetails;
  dashboardState: DashboardState;
  dashboards: DashboardListItem[];
  onAddWidget: (dataset: DataSet) => void;
  onAddWidgetFromNewWidgetBuilder: (
    dataset: DataSet,
    openWidgetTemplates: boolean
  ) => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  organization: Organization;
  widgetLimitReached: boolean;
  hasUnsavedFilters?: boolean;
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
  onAddWidgetFromNewWidgetBuilder,
}: Props) {
  const [isFavorited, setIsFavorited] = useState(dashboard.isFavorited);

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
  if ([DashboardState.EDIT, DashboardState.PENDING_DELETE].includes(dashboardState)) {
    return (
      <StyledButtonBar gap={1} key="edit-controls">
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
      <StyledButtonBar gap={1} key="create-controls">
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
      <StyledButtonBar gap={1} key="preview-controls">
        {renderCancelButton(t('Go Back'))}
        <Button
          data-test-id="dashboard-commit"
          size="sm"
          onClick={e => {
            e.preventDefault();
            onCommit();
          }}
          priority="primary"
        >
          {t('Add Dashboard')}
        </Button>
      </StyledButtonBar>
    );
  }

  const defaultDataset = organization.features.includes(
    'performance-discover-dataset-selector'
  )
    ? DataSet.ERRORS
    : DataSet.EVENTS;

  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboard.permissions,
    dashboard.createdBy
  );

  const addWidgetDropdownItems: MenuItemProps[] = [
    {
      key: 'from-widget-library',
      label: t('From Widget Library'),
      onAction: () => onAddWidgetFromNewWidgetBuilder(defaultDataset, true),
    },
    {
      key: 'create-custom-widget',
      label: t('Create Custom Widget'),
      onAction: () => onAddWidgetFromNewWidgetBuilder(defaultDataset, false),
    },
  ];

  return (
    <StyledButtonBar gap={1} key="controls">
      <FeedbackWidgetButton />
      <DashboardEditFeature>
        {hasFeature => (
          <Fragment>
            <Feature features="dashboards-import">
              <Button
                data-test-id="dashboard-export"
                onClick={e => {
                  e.preventDefault();
                  exportDashboard();
                }}
                icon={<IconDownload />}
                priority="default"
                size="sm"
              >
                {t('Export Dashboard')}
              </Button>
            </Feature>
            {dashboard.id !== 'default-overview' && (
              <Feature features="dashboards-favourite">
                <Button
                  size="sm"
                  aria-label={'dashboards-favourite'}
                  icon={
                    <IconStar
                      color={isFavorited ? 'yellow300' : 'gray300'}
                      isSolid={isFavorited}
                      aria-label={isFavorited ? t('UnFavorite') : t('Favorite')}
                      data-test-id={isFavorited ? 'yellow-star' : 'empty-star'}
                    />
                  }
                  onClick={async () => {
                    try {
                      setIsFavorited(!isFavorited);
                      await updateDashboardFavorite(
                        api,
                        organization.slug,
                        dashboard.id,
                        !isFavorited
                      );
                      trackAnalytics('dashboards_manage.favourite', {
                        organization,
                        dashboard_id: dashboard.id,
                        favourited: !isFavorited,
                      });
                    } catch (error) {
                      // If the api call fails, revert the state
                      setIsFavorited(isFavorited);
                    }
                  }}
                />
              </Feature>
            )}
            {dashboard.id !== 'default-overview' && (
              <EditAccessSelector
                dashboard={dashboard}
                onChangeEditAccess={onChangeEditAccess}
              />
            )}
            <Button
              data-test-id="dashboard-edit"
              onClick={e => {
                e.preventDefault();
                onEdit();
              }}
              icon={<IconEdit />}
              disabled={!hasFeature || hasUnsavedFilters || !hasEditAccess}
              title={
                !hasEditAccess
                  ? t('You do not have permission to edit this dashboard')
                  : hasUnsavedFilters && UNSAVED_FILTERS_MESSAGE
              }
              priority="default"
              size="sm"
            >
              {t('Edit Dashboard')}
            </Button>
            {hasFeature ? (
              <Tooltip
                title={tct('Max widgets ([maxWidgets]) per dashboard reached.', {
                  maxWidgets: MAX_WIDGETS,
                })}
                disabled={!widgetLimitReached}
              >
                {hasCustomMetrics(organization) ? (
                  <AddWidgetButton
                    onAddWidget={onAddWidget}
                    aria-label={t('Add Widget')}
                    priority="primary"
                    data-test-id="add-widget-library"
                    disabled={widgetLimitReached}
                  />
                ) : organization.features.includes(
                    'dashboards-widget-builder-redesign'
                  ) ? (
                  <DropdownMenu
                    items={addWidgetDropdownItems}
                    isDisabled={widgetLimitReached || !hasEditAccess}
                    triggerLabel={t('Add Widget')}
                    triggerProps={{
                      'aria-label': t('Add Widget'),
                      size: 'sm',
                      showChevron: true,
                      icon: <IconAdd isCircled size="sm" />,
                      priority: 'primary',
                    }}
                    position="bottom-end"
                  />
                ) : (
                  <Button
                    data-test-id="add-widget-library"
                    priority="primary"
                    size="sm"
                    disabled={widgetLimitReached || !hasEditAccess}
                    icon={<IconAdd isCircled />}
                    onClick={() => {
                      trackAnalytics('dashboards_views.widget_library.opened', {
                        organization,
                      });
                      onAddWidget(defaultDataset);
                    }}
                    title={
                      !hasEditAccess &&
                      t('You do not have permission to edit this dashboard')
                    }
                  >
                    {t('Add Widget')}
                  </Button>
                )}
              </Tooltip>
            ) : null}
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
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: row;
    grid-row-gap: ${space(1)};
    width: 100%;
  }
`;

export default Controls;
