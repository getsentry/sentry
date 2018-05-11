import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/barChart';
import SentryTypes from 'app/proptypes';

class OrganizationStatsChart extends AsyncComponent {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    const {organization} = this.props;

    return [
      [
        'data',
        `/organizations/${organization.slug}/stats/`,
        {
          query: {
            since: new Date().getTime() / 1000 - 3600 * 24,
            stat: 'received',
          },
        },
      ],
    ];
  }

  renderLoading() {
    return null;
  }

  renderBody() {
    const {data} = this.state;
    if (!data) return null;

    let points = data.map(d => ({x: d[0], y: d[1]}));
    return (
      <OrganizationStatsChartWrapper>
        {t('Last 24h')}
        <StyledBarChart points={points} label="events" height={60} />{' '}
      </OrganizationStatsChartWrapper>
    );
  }
}

const OrganizationStatsChartWrapper = styled('div')`
  font-size: 10px;
  margin-top: 24px;
  padding-left: 4px;
  padding-right: 4px;
`;

const StyledBarChart = styled(BarChart)`
  a {
    &:not(:first-child) {
      border-left: 2px solid transparent;
    }
    &:not(:last-child) {
      border-right: 2px solid transparent;
    }
    > span {
      left: 0;
      right: 0;
    }
  }
`;

export default OrganizationStatsChart;
