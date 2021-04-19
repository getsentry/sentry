import React from 'react';
import styled from '@emotion/styled';
import {browserHistory} from 'react-router';
import {Location, Query} from 'history';

import WidgetArea from 'sentry-images/dashboard/widget-area.svg';
import WidgetBar from 'sentry-images/dashboard/widget-bar.svg';
import WidgetBigNumber from 'sentry-images/dashboard/widget-big-number.svg';
import WidgetLine from 'sentry-images/dashboard/widget-line-1.svg';
import WidgetTable from 'sentry-images/dashboard/widget-table.svg';
import WidgetWorldMap from 'sentry-images/dashboard/widget-world-map.svg';

import Pagination from 'app/components/pagination';
import TimeSince from 'app/components/timeSince';
import {tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {DashboardDetails, Widget} from 'app/views/dashboardsV2/types';

import DashboardCard from './dashboardCard';

type Props = {
  organization: Organization;
  location: Location;
  dashboards: DashboardDetails[] | null;
  pageLinks: string;
};

class MiniDashboard extends React.PureComponent<Props> {
  static miniWidget(widget: Widget): React.ReactNode {
    switch (widget.displayType) {
      case 'bar':
        return <MiniWidgetWrapper src={WidgetBar} />;
      case 'area':
        return <MiniWidgetWrapper src={WidgetArea} />;
      case 'big_number':
        return <BigNumberWidgetWrapper src={WidgetBigNumber} />;
      case 'table':
        return <MiniWidgetWrapper src={WidgetTable} />;
      case 'world_map':
        return <MiniWidgetWrapper src={WidgetWorldMap} />;
      case 'line':
      default:
        return <MiniWidgetWrapper src={WidgetLine} />;
    }
  }
}

class DashboardList extends React.Component<Props> {
  renderMiniDashboards() {
    const {organization, dashboards} = this.props;
    return dashboards?.map((dashboard, index) => {
      return (
        <DashboardCard
          key={`${index}-${dashboard.id}`}
          title={dashboard.title}
          to={{
            pathname: `/organizations/${organization.slug}/dashboards/${dashboard.id}`,
            query: {},
          }}
          detail={
            dashboard.widgets.length > 1
              ? tct('[numWidgets] widgets', {numWidgets: dashboard.widgets.length})
              : tct('[numWidgets] widget', {numWidgets: dashboard.widgets.length})
          }
          dateStatus={<TimeSince date={dashboard.dateCreated} />}
          createdBy={dashboard.createdBy}
          renderWidgets={() => (
            <WidgetGrid>
              {dashboard.widgets.map(w => MiniDashboard.miniWidget(w))}
            </WidgetGrid>
          )}
        />
      );
    });
  }

  render() {
    const {pageLinks} = this.props;
    return (
      <React.Fragment>
        <DashboardGrid>{this.renderMiniDashboards()}</DashboardGrid>
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
  margin-bottom: 20px;
`;

export default DashboardList;
