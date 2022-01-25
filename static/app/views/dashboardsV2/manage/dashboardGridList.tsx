import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import {
  createDashboard,
  deleteDashboard,
  fetchDashboard,
} from 'sentry/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import MenuItem from 'sentry/components/menuItem';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import {DashboardListItem, DisplayType} from 'sentry/views/dashboardsV2/types';

import ContextMenu from '../contextMenu';
import {cloneDashboard} from '../utils';

import DashboardCard from './dashboardCard';
import WidgetGrid from './widgetGrid';

type Props = {
  api: Client;
  organization: Organization;
  location: Location;
  dashboards: DashboardListItem[] | null;
  pageLinks: string;
  onDashboardsChange: () => void;
};

function DashboardList({
  api,
  organization,
  location,
  dashboards,
  pageLinks,
  onDashboardsChange,
}: Props) {
  function handleDelete(dashboard: DashboardListItem) {
    deleteDashboard(api, organization.slug, dashboard.id)
      .then(() => {
        trackAnalyticsEvent({
          eventKey: 'dashboards_manage.delete',
          eventName: 'Dashboards Manager: Dashboard Deleted',
          organization_id: parseInt(organization.id, 10),
          dashboard_id: parseInt(dashboard.id, 10),
        });
        onDashboardsChange();
        addSuccessMessage(t('Dashboard deleted'));
      })
      .catch(() => {
        addErrorMessage(t('Error deleting Dashboard'));
      });
  }

  function handleDuplicate(dashboard: DashboardListItem) {
    fetchDashboard(api, organization.slug, dashboard.id)
      .then(dashboardDetail => {
        const newDashboard = cloneDashboard(dashboardDetail);
        newDashboard.widgets.map(widget => (widget.id = undefined));
        createDashboard(api, organization.slug, newDashboard, true).then(() => {
          trackAnalyticsEvent({
            eventKey: 'dashboards_manage.duplicate',
            eventName: 'Dashboards Manager: Dashboard Duplicated',
            organization_id: parseInt(organization.id, 10),
            dashboard_id: parseInt(dashboard.id, 10),
          });
          onDashboardsChange();
          addSuccessMessage(t('Dashboard duplicated'));
        });
      })
      .catch(() => addErrorMessage(t('Error duplicating Dashboard')));
  }

  function renderMiniDashboards() {
    debugger;
    return dashboards?.map((dashboard, index) => {
      return (
        <DashboardCard
          key={`${index}-${dashboard.id}`}
          title={
            dashboard.id === 'default-overview' ? 'Default Dashboard' : dashboard.title
          }
          to={{
            pathname: `/organizations/${organization.slug}/dashboard/${dashboard.id}/`,
            query: {...location.query},
          }}
          detail={tn('%s widget', '%s widgets', dashboard.widgetDisplay.length)}
          dateStatus={
            dashboard.dateCreated ? <TimeSince date={dashboard.dateCreated} /> : undefined
          }
          createdBy={dashboard.createdBy}
          renderWidgets={() => <WidgetGrid layout={dashboard.layout} />}
          renderContextMenu={() => (
            <ContextMenu>
              <MenuItem
                data-test-id="dashboard-delete"
                disabled={dashboards.length <= 1}
                onClick={event => {
                  event.preventDefault();
                  openConfirmModal({
                    message: t('Are you sure you want to delete this dashboard?'),
                    priority: 'danger',
                    onConfirm: () => handleDelete(dashboard),
                  });
                }}
              >
                {t('Delete')}
              </MenuItem>
              <MenuItem
                data-test-id="dashboard-duplicate"
                onClick={event => {
                  event.preventDefault();
                  handleDuplicate(dashboard);
                }}
              >
                {t('Duplicate')}
              </MenuItem>
            </ContextMenu>
          )}
        />
      );
    });
  }

  function renderDashboardGrid() {
    if (!dashboards?.length) {
      return (
        <EmptyStateWarning>
          <p>{t('Sorry, no Dashboards match your filters.')}</p>
        </EmptyStateWarning>
      );
    }
    return <DashboardGrid>{renderMiniDashboards()}</DashboardGrid>;
  }

  return (
    <Fragment>
      {renderDashboardGrid()}
      <PaginationRow
        pageLinks={pageLinks}
        onCursor={(cursor, path, query, direction) => {
          const offset = Number(cursor?.split?.(':')?.[1] ?? 0);

          const newQuery: Query & {cursor?: string} = {...query, cursor};
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }

          trackAnalyticsEvent({
            eventKey: 'dashboards_manage.paginate',
            eventName: 'Dashboards Manager: Paginate',
            organization_id: parseInt(organization.id, 10),
          });

          browserHistory.push({
            pathname: path,
            query: newQuery,
          });
        }}
      />
    </Fragment>
  );
}

const DashboardGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-template-rows: repeat(3, max-content);
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

export default withApi(DashboardList);
