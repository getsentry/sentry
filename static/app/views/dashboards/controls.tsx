import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import {Hovercard} from 'sentry/components/hovercard';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconDownload, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
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
}: Props) {
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

  let hasEditAccess = true;
  if (organization.features.includes('dashboards-edit-access')) {
    hasEditAccess = checkUserHasEditAccess(
      currentUser,
      userTeams,
      organization,
      dashboard.permissions,
      dashboard.createdBy
    );
  }

  return (
    <StyledButtonBar gap={1} key="controls">
      <DashboardEditFeature>
        {hasFeature => (
          <Fragment>
            <FeedbackWidgetButton />
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
            <Feature features="dashboards-edit-access">
              <EditAccessSelector
                dashboard={dashboard}
                onChangeEditAccess={onChangeEditAccess}
              />
            </Feature>
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
  const renderDisabled = p => (
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
