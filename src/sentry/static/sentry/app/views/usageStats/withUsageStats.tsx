import React from 'react';
import moment from 'moment';

import {Client} from 'app/api';
import {Organization} from 'app/types';

import {OrganizationUsageStats, ProjectUsageStats} from './types';

type InjectedStatsProps = {
  api: Client;
  organization: Organization;
} & State;

type State = {
  orgStats?: OrganizationUsageStats;
  orgStatsLoading: boolean;
  orgStatsError?: Error;

  projectStats?: ProjectUsageStats[];
  projectStatsLoading: boolean;
  projectStatsError?: Error;
};

const withUsageStats = <P extends InjectedStatsProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  return class extends React.Component<P & InjectedStatsProps, State> {
    state: State = {
      orgStatsLoading: false,
      projectStatsLoading: false,
    };

    componentDidMount() {
      this.getOrganizationStats();
      this.getProjectsStats();
    }

    async getOrganizationStats() {
      const {api, organization} = this.props;
      const fourWeeksAgo = moment().subtract(31, 'days').unix();
      const today = moment().unix();

      // TODO: Hardcoded org_slug
      try {
        const orgStats = await api.requestPromise(
          `/organizations/${organization.slug}/stats_v2/`,
          {
            method: 'GET',
            query: {
              start: fourWeeksAgo,
              end: today,
              interval: '1d',
            },
          }
        );

        this.setState({
          orgStats,
          orgStatsLoading: false,
          orgStatsError: undefined,
        });
      } catch (e) {
        this.setState({
          orgStats: undefined,
          orgStatsLoading: false,
          orgStatsError: e,
        });
      }
    }

    /**
     * Fetches aggregated stats of tne entire organization
     */
    /*
    _getOrganizationStats() {
      this.setState({orgStatsLoading: true});

      const orgStats: OrganizationUsageStats = {
        statsErrors: [],
        statsTransactions: [],
        statsAttachments: [],
      };

      for (let i = 0; i < 31; i++) {
        const stats = {
          ts: moment().subtract(i, 'days').valueOf().toString(),
          accepted: {timesSeen: 100, quantity: 1000},
          filtered: {timesSeen: 100, quantity: 1000},
          dropped: {
            overQuota: {timesSeen: 100, quantity: 1000},
            spikeProtection: {timesSeen: 100, quantity: 1000},
            other: {timesSeen: 100, quantity: 1000},
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
    */

    /**
     * Fetches stats of projects that the user has access to
     */
    async getProjectsStats() {
      const {api, organization} = this.props;
      const fourWeeksAgo = moment().subtract(31, 'days').unix();
      const today = moment().unix();

      // TODO: Hardcoded org_slug
      try {
        const projectStats = await api.requestPromise(
          `/organizations/${organization.slug}/stats_v2/projects/`,
          {
            method: 'GET',
            query: {
              start: fourWeeksAgo,
              end: today,
              interval: '1d',
            },
          }
        );

        this.setState({
          projectStats,
          projectStatsLoading: false,
          projectStatsError: undefined,
        });
      } catch (e) {
        this.setState({
          projectStats: undefined,
          projectStatsLoading: false,
          projectStatsError: e,
        });
      }
    }

    render() {
      return <WrappedComponent {...this.props} {...this.state} />;
    }
  };
};

export default withUsageStats;
