import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, Query} from 'history';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboard/widget-world-map.svg';

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
  function miniWidget(displayType: DisplayType): string {
    switch (displayType) {
      case DisplayType.BAR:
        return WidgetBar;
      case DisplayType.AREA:
      case DisplayType.TOP_N:
        return WidgetArea;
      case DisplayType.BIG_NUMBER:
        return WidgetBigNumber;
      case DisplayType.TABLE:
        return WidgetTable;
      case DisplayType.WORLD_MAP:
        return WidgetWorldMap;
      case DisplayType.LINE:
      default:
        return WidgetLine;
    }
  }

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
          renderWidgets={() => (
            <WidgetGrid>
              {dashboard.widgetDisplay.map((displayType, i) => {
                return displayType === DisplayType.BIG_NUMBER ? (
                  <BigNumberWidgetWrapper key={`${i}-${displayType}`}>
                    <WidgetImage src={miniWidget(displayType)} />
                  </BigNumberWidgetWrapper>
                ) : (
                  <MiniWidgetWrapper key={`${i}-${displayType}`}>
                    <WidgetImage src={miniWidget(displayType)} />
                  </MiniWidgetWrapper>
                );
              })}
            </WidgetGrid>
          )}
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
  grid-gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

const WidgetGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-flow: row dense;
  grid-gap: ${space(0.25)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[4]}) {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }
`;

const BigNumberWidgetWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;

  /* 2 cols */
  grid-area: span 1 / span 2;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    /* 4 cols */
    grid-area: span 1 / span 1;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    /* 6 and 8 cols */
    grid-area: span 1 / span 2;
  }
`;

const MiniWidgetWrapper = styled('div')`
  display: flex;
  align-items: flex-start;
  width: 100%;
  height: 100%;
  grid-area: span 2 / span 2;
`;

const WidgetImage = styled('img')`
  width: 100%;
  height: 100%;
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

export default withApi(DashboardList);
