import React from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Card from 'app/components/card';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import {Panel, PanelBody} from 'app/components/panels';
import {t, tct} from 'app/locale';
import {PageContent, PageHeader} from 'app/styles/organization';
import space from 'app/styles/space';
import {Organization} from 'app/types';

import {OrganizationUsageStats, ProjectUsageStats} from './types';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type State = {
  dataCategory: DataCategory;

  orgStats?: OrganizationUsageStats;
  orgStatsLoading: boolean;
  orgStatsError?: Error;

  projectStats?: ProjectUsageStats[];
  projectStatsLoading: boolean;
  projectStatsError?: Error;
};

// TODO: Move over from getsentry
export enum DataCategory {
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  ATTACHMENTS = 'attachments',
}

class OrganizationStats extends React.Component<Props, State> {
  state: State = {
    dataCategory: DataCategory.ERRORS,
    orgStatsLoading: false,
    projectStatsLoading: false,
  };

  componentDidMount() {
    this.getOrganizationStats();
    this.getProjectsStats();
  }

  setSelectedDataCategory = (dataCategory: DataCategory) => {
    this.setState({dataCategory});
  };
  get selectedDataCategory() {
    return capitalize(this.state.dataCategory);
  }

  /**
   * Fetches aggregated stats of tne entire organization
   */
  getOrganizationStats() {
    this.setState({orgStatsLoading: true});

    const orgStats: OrganizationUsageStats = {
      statsErrors: [],
      statsTransactions: [],
      statsAttachments: [],
    };

    for (let i = 0; i < 31; i++) {
      const stats = {
        ts: i.toString(),
        accepted: {timesSeen: i * 100, quantity: i * 1000},
        filtered: {timesSeen: i * 100, quantity: i * 1000},
        dropped: {
          overQuota: {timesSeen: i * 100, quantity: i * 1000},
          spikeProtection: {timesSeen: i * 100, quantity: i * 1000},
          other: {timesSeen: i * 100, quantity: i * 1000},
        },
      };

      orgStats.statsErrors.push(stats);
      orgStats.statsTransactions.push(stats);
      orgStats.statsAttachments.push(stats);
    }

    setTimeout(() => {
      this.setState({
        orgStatsLoading: false,
        orgStats,
      });
    }, 3000);
  }

  /**
   * Fetches stats of projects that the user has access to
   */
  getProjectsStats() {
    return [];
  }

  renderCards() {
    return (
      <CardWrapper>
        <Card>
          {tct('Total [dataCategory]', {dataCategory: this.selectedDataCategory})}
        </Card>
        <Card>{t('Accepted')}</Card>
        <Card>{t('Rate-limited')}</Card>
        <Card>{t('Filtered')}</Card>
      </CardWrapper>
    );
  }

  renderChart() {
    if (this.state.orgStatsLoading) {
      return (
        <Panel>
          <PanelBody>
            <LoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    return (
      <Panel>
        <PanelBody>This is the chart</PanelBody>
      </Panel>
    );
  }

  render() {
    const {dataCategory} = this.state;

    return (
      <PageContent>
        <PageHeader>
          <PageHeading>
            {tct('Organization Usage Stats for [dataCategory]', {
              dataCategory: this.selectedDataCategory,
            })}

            <ButtonBar active={dataCategory} merged>
              {Object.keys(DataCategory).map(k => {
                return (
                  <Button
                    key={DataCategory[k]}
                    barId={DataCategory[k]}
                    onClick={() => this.setSelectedDataCategory(DataCategory[k])}
                  >
                    {capitalize(DataCategory[k])}
                  </Button>
                );
              })}
            </ButtonBar>
          </PageHeading>
        </PageHeader>
        {this.renderCards()}
        {this.renderChart()}
      </PageContent>
    );
  }
}

export default OrganizationStats;

const CardWrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  grid-auto-rows: 1fr;
  grid-gap: ${space(2)};
  margin-bottom: ${space(3)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
  }
`;
