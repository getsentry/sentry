import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import BarChart from 'app/components/barChart';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';

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

    let series = data.map(d => ({data: [{x: d[0], y: d[1]}], label: 'events'})) || [];
    return (
      <OrganizationStatsChartWrapper>
        {t('Last 24h')}
        <BarChart series={series} height={60} width={7} />{' '}
      </OrganizationStatsChartWrapper>
    );
  }
}

const OrganizationStatsChartWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  margin-top: ${space(3)};
  padding-left: ${space(0.5)};
  padding-right: ${space(0.5)};
`;

export default OrganizationStatsChart;
