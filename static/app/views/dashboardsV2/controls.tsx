import {Fragment} from 'react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import FeatureDisabled from 'sentry/components/acl/featureDisabled';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import {Hovercard} from 'sentry/components/hovercard';
import Tooltip from 'sentry/components/tooltip';
import {IconAdd, IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {UNSAVED_FILTERS_MESSAGE} from './detail';
import {DashboardListItem, DashboardState, MAX_WIDGETS} from './types';

type Props = {
  dashboardState: DashboardState;
  dashboards: DashboardListItem[];
  onAddWidget: () => void;
  onCancel: () => void;
  onCommit: () => void;
  onDelete: () => void;
  onEdit: () => void;
  organization: Organization;
  widgetLimitReached: boolean;
  hasUnsavedFilters?: boolean;
};

function Controls({
  organization,
  dashboardState,
  dashboards,
  hasUnsavedFilters,
  widgetLimitReached,
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
        onClick={e => {
          e.preventDefault();
          onCancel();
        }}
      >
        {label}
      </Button>
    );
  }

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
          <Button data-test-id="dashboard-delete" priority="danger">
            {t('Delete')}
          </Button>
        </Confirm>
        <Button
          data-test-id="dashboard-commit"
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

  return (
    <StyledButtonBar gap={1} key="controls">
      <DashboardEditFeature>
        {hasFeature => (
          <Fragment>
            <Button
              data-test-id="dashboard-edit"
              onClick={e => {
                e.preventDefault();
                onEdit();
              }}
              icon={<IconEdit />}
              disabled={!hasFeature || hasUnsavedFilters}
              title={hasUnsavedFilters && UNSAVED_FILTERS_MESSAGE}
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
                <GuideAnchor
                  disabled={!organization.features.includes('dashboards-releases')}
                  target="releases_widget"
                >
                  <Button
                    data-test-id="add-widget-library"
                    priority="primary"
                    size="sm"
                    disabled={widgetLimitReached}
                    icon={<IconAdd isCircled />}
                    onClick={() => {
                      trackAdvancedAnalyticsEvent(
                        'dashboards_views.widget_library.opened',
                        {
                          organization,
                        }
                      );
                      onAddWidget();
                    }}
                  >
                    {t('Add Widget')}
                  </Button>
                </GuideAnchor>
              </Tooltip>
            ) : null}
          </Fragment>
        )}
      </DashboardEditFeature>
    </StyledButtonBar>
  );
}

const DashboardEditFeature = ({
  children,
}: {
  children: (hasFeature: boolean) => React.ReactNode;
}) => {
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
      features={['organizations:dashboards-edit']}
      renderDisabled={renderDisabled}
    >
      {({hasFeature}) => children(hasFeature)}
    </Feature>
  );
};

const StyledButtonBar = styled(ButtonBar)`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-auto-flow: row;
    grid-row-gap: ${space(1)};
    width: 100%;
  }
`;

export default Controls;
