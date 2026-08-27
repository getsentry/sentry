import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {FeatureDisabled} from 'sentry/components/acl/featureDisabled';
import {Confirm} from 'sentry/components/confirm';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {Hovercard} from 'sentry/components/hovercard';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import {EditAccessSelector} from 'sentry/views/dashboards/editAccessSelector';
import {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';

import {checkUserHasEditAccess} from './utils/checkUserHasEditAccess';
import type {DashboardDetails, DashboardPermissions} from './types';
import {DashboardState, MAX_WIDGETS} from './types';

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
  const organization = useOrganization();
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();

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
        <Button
          size="sm"
          onClick={handleCommit}
          variant="primary"
          data-test-id="dashboard-commit"
        >
          {t('Save and Finish')}
        </Button>
        <Confirm
          priority="danger"
          message={t('Are you sure you want to delete this dashboard?')}
          onConfirm={onDelete}
        >
          <Button size="sm" variant="danger" data-test-id="dashboard-delete">
            {t('Delete')}
          </Button>
        </Confirm>
        <Button
          size="sm"
          variant="transparent"
          onClick={handleCancel}
          data-test-id="dashboard-cancel"
        >
          {t('Cancel')}
        </Button>
      </DashboardControls>
    );
  }

  if (dashboardState === DashboardState.CREATE) {
    return (
      <DashboardControls>
        <Button
          size="sm"
          variant="transparent"
          onClick={handleCancel}
          data-test-id="dashboard-cancel"
        >
          {t('Cancel')}
        </Button>
        <Button
          size="sm"
          onClick={handleCommit}
          variant="primary"
          data-test-id="dashboard-commit"
        >
          {t('Save and Finish')}
        </Button>
      </DashboardControls>
    );
  }

  if (dashboardState === DashboardState.PREVIEW) {
    return (
      <DashboardControls>
        <Button size="sm" onClick={handleCancel} data-test-id="dashboard-cancel">
          {t('Go Back')}
        </Button>
        <DashboardCreateLimitWrapper>
          {({hasReachedDashboardLimit, isLoading, limitMessage}) => (
            <Button
              size="sm"
              onClick={handleCommit}
              variant="primary"
              data-test-id="dashboard-commit"
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
