import React from 'react';
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
} from 'app/actionCreators/dashboards';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import MenuItem from 'app/components/menuItem';
import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import {DashboardListItem, DisplayType} from 'app/views/dashboardsV2/types';

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
          title={dashboard.title}
          to={{
            pathname: `/organizations/${organization.slug}/dashboards/${dashboard.id}/`,
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
                  <BigNumberWidgetWrapper
                    key={`${i}-${displayType}`}
                    src={miniWidget(displayType)}
                  />
                ) : (
                  <MiniWidgetWrapper
                    key={`${i}-${displayType}`}
                    src={miniWidget(displayType)}
                  />
                );
              })}
            </WidgetGrid>
          )}
          renderContextMenu={() => (
            <ContextMenu>
              <MenuItem
                data-test-id="dashboard-delete"
                onClick={event => {
                  event.preventDefault();
                  handleDelete(dashboard);
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
    <React.Fragment>
      {renderDashboardGrid()}
      <PaginationRow
        pageLinks={pageLinks}
        onCursor={(cursor: string, path: string, query: Query, direction: number) => {
          const offset = Number(cursor.split(':')[1]);

          const newQuery: Query & {cursor?: string} = {...query, cursor};
          const isPrevious = direction === -1;

          if (offset <= 0 && isPrevious) {
            delete newQuery.cursor;
          }

          browserHistory.push({
            pathname: path,
            query: newQuery,
          });
        }}
      />
    </React.Fragment>
  );
}

const DashboardGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(3)};

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

const BigNumberWidgetWrapper = styled('img')`
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

const MiniWidgetWrapper = styled('img')`
  width: 100%;
  height: 100%;
  grid-area: span 2 / span 2;
`;

const PaginationRow = styled(Pagination)`
  margin-bottom: ${space(3)};
`;

export default withApi(DashboardList);
