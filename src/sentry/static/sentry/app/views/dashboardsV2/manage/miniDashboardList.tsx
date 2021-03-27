import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import AsyncComponent from 'app/components/asyncComponent';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';
import MiniDashboard from 'app/views/dashboardsV2/manage/miniDashboard';
import {DashboardDetailedListItem} from 'app/views/dashboardsV2/types';

type Props = {
  organization: Organization;
  location: Location;
} & AsyncComponent['props'];

type State = {
  dashboards?: DashboardDetailedListItem[];
  savedQueriesPageLinks?: string;
} & AsyncComponent['state'];

class MiniDashboardList extends AsyncComponent<Props, State> {
  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],
  };

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location} = this.props;
    return [
      [
        'dashboards',
        `/organizations/${organization.slug}/dashboards/`,
        {
          query: {
            expand: ['createdBy', 'widgets'],
            per_page: 18,
            cursor: location.query.cursor,
          },
        },
      ],
    ];
  }

  renderBody(): React.ReactNode {
    const {dashboards, dashboardsPageLinks} = this.state;
    return (
      <React.Fragment>
        {dashboards ? (
          <DashboardGrid>
            {dashboards.map(dashboard => (
              <MiniDashboard key={`${dashboard.id}`} dashboard={dashboard} />
            ))}
          </DashboardGrid>
        ) : (
          <EmptyStateWarning>
            <p>{t('No dashboards match that filter')}</p>
          </EmptyStateWarning>
        )}
        <Pagination pageLinks={dashboardsPageLinks} />
      </React.Fragment>
    );
  }
}

export default withOrganization(MiniDashboardList);

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
