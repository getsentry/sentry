import React from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';

import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, Project, TimeseriesValue} from 'app/types';
import {Series} from 'app/types/echarts';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import OrganizationStatsDetails from './organizationStatsDetails';
import {OrgTotal, ProjectTotal} from './types';

type Props = {
  api: Client;
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}>;

type RawData = {
  received: TimeseriesValue[];
  rejected: TimeseriesValue[];
  blacklisted: TimeseriesValue[];
};

type State = {
  projectsError: boolean;
  projectsLoading: boolean;
  projectsRequestsPending: number;
  statsError: boolean;
  statsLoading: boolean;
  statsRequestsPending: number;
  projectMap: Record<string, Project>;
  rawProjectData: {
    received: Record<string, TimeseriesValue[]>;
    rejected: Record<string, TimeseriesValue[]>;
    blacklisted: Record<string, TimeseriesValue[]>;
  };
  rawOrgData: RawData;
  orgSeries: null | Series[];
  orgTotal: null | OrgTotal;
  projectTotals: null | ProjectTotal[];
  querySince: number;
  queryUntil: number;
  pageLinks: null | string;
};

class OrganizationStatsContainer extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 7;

    this.state = {
      projectsError: false,
      projectsLoading: false,
      projectsRequestsPending: 0,
      statsError: false,
      statsLoading: false,
      statsRequestsPending: 0,
      projectMap: {},
      rawProjectData: {received: {}, rejected: {}, blacklisted: {}},
      rawOrgData: {received: [], rejected: [], blacklisted: []},
      orgSeries: null,
      orgTotal: null,
      projectTotals: null,
      querySince: since,
      queryUntil: until,
      pageLinks: null,
    };
  }

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    // If query string changes, it will be due to pagination.
    // Intentionally only fetch projects since stats are fetched for a fixed period during
    // the initial payload
    if (nextProps.location.search !== this.props.location.search) {
      this.setState({
        projectsError: false,
        projectsRequestsPending: 1,
        projectsLoading: true,
      });
    }
  }

  componentDidUpdate(prevProps: Props) {
    const prevParams = prevProps.params,
      currentParams = this.props.params;

    if (prevParams.orgId !== currentParams.orgId) {
      this.fetchData();
    }

    // Query string is changed, probably due to pagination, re-fetch only project data
    if (prevProps.location.search !== this.props.location.search) {
      // Not sure why, but when we use pagination and the new results load and re-render,
      // the scroll position does not reset to top like in Audit Log
      if (window.scrollTo) {
        window.scrollTo(0, 0);
      }
      this.fetchProjectData();
    }
    const state = this.state;
    if (state.statsLoading && !state.statsRequestsPending) {
      this.processOrgData();
    }
    if (state.projectsLoading && !state.projectsRequestsPending) {
      this.processProjectData();
    }
  }

  fetchProjectData() {
    this.props.api.request(this.getOrganizationProjectsEndpoint(), {
      query: this.props.location.query,
      success: (data, _textStatus, jqxhr) => {
        const projectMap: Record<string, Project> = {};
        data.forEach((project: Project) => {
          projectMap[project.id] = project;
        });

        this.setState(prevState => ({
          pageLinks: jqxhr ? jqxhr.getResponseHeader('Link') : null,
          projectMap,
          projectsRequestsPending: prevState.projectsRequestsPending - 1,
        }));
      },
      error: () => {
        this.setState({
          projectsError: true,
        });
      },
    });
  }

  fetchData() {
    this.setState({
      statsError: false,
      statsLoading: true,
      statsRequestsPending: 3,
      projectsError: false,
      projectsLoading: true,
      projectsRequestsPending: 4,
    });

    const statEndpoint = this.getOrganizationStatsEndpoint();

    Object.keys(this.state.rawOrgData).forEach(statName => {
      this.props.api.request(statEndpoint, {
        query: {
          since: this.state.querySince,
          until: this.state.queryUntil,
          resolution: '1h',
          stat: statName,
        },
        success: data => {
          this.setState(prevState => {
            const rawOrgData = prevState.rawOrgData;
            rawOrgData[statName] = data;

            return {
              rawOrgData,
              statsRequestsPending: prevState.statsRequestsPending - 1,
            };
          });
        },
        error: () => {
          this.setState({
            statsError: true,
          });
        },
      });
    });

    Object.keys(this.state.rawProjectData).forEach(statName => {
      this.props.api.request(statEndpoint, {
        query: {
          since: this.state.querySince,
          until: this.state.queryUntil,
          stat: statName,
          group: 'project',
        },
        success: data => {
          this.setState(prevState => {
            const rawProjectData = prevState.rawProjectData;
            rawProjectData[statName] = data;

            return {
              rawProjectData,
              projectsRequestsPending: prevState.projectsRequestsPending - 1,
            };
          });
        },
        error: () => {
          this.setState({
            projectsError: true,
          });
        },
      });
    });

    this.fetchProjectData();
  }

  getOrganizationStatsEndpoint() {
    const params = this.props.params;
    return '/organizations/' + params.orgId + '/stats/';
  }

  getOrganizationProjectsEndpoint() {
    const params = this.props.params;
    return '/organizations/' + params.orgId + '/projects/';
  }

  processOrgData() {
    let oReceived = 0;
    let oRejected = 0;
    let oBlacklisted = 0;
    const aReceived = [0, 0]; // received, points
    const rawOrgData = this.state.rawOrgData;

    const orgAccepted: Series = {
      seriesName: t('Accepted'),
      color: theme.gray200,
      data: [],
    };
    const orgRejected: Series = {
      seriesName: t('Rate limited'),
      color: theme.red300,
      data: [],
    };
    const orgFiltered: Series = {
      seriesName: t('Filtered'),
      color: theme.orange400,
      data: [],
    };

    rawOrgData.received.forEach((point, idx) => {
      const dReceived = point[1];
      const dRejected = rawOrgData.rejected[idx][1];
      const dFiltered = rawOrgData.blacklisted[idx][1];
      const dAccepted = Math.max(0, dReceived - dRejected - dFiltered);

      const time = point[0] * 1000;
      orgAccepted.data.push({name: time, value: dAccepted});
      orgRejected.data.push({name: time, value: dRejected});
      orgFiltered.data.push({name: time, value: dFiltered});
      oReceived += dReceived;
      oRejected += dRejected;
      oBlacklisted += dFiltered;
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });

    this.setState({
      orgSeries: [orgAccepted, orgRejected, orgFiltered],
      orgTotal: {
        id: '',
        received: oReceived,
        rejected: oRejected,
        blacklisted: oBlacklisted,
        accepted: Math.max(0, oReceived - oRejected - oBlacklisted),
        avgRate: aReceived[1] ? Math.round(aReceived[0] / aReceived[1] / 60) : 0,
      },
      statsLoading: false,
    });
  }

  processProjectData() {
    const rawProjectData = this.state.rawProjectData;
    const projectTotals: ProjectTotal[] = [];
    Object.keys(rawProjectData.received).forEach(projectId => {
      const data = rawProjectData.received[projectId];
      let pReceived = 0;
      let pRejected = 0;
      let pBlacklisted = 0;
      data.forEach((point, idx) => {
        pReceived += point[1];
        pRejected += rawProjectData.rejected[projectId][idx][1];
        pBlacklisted += rawProjectData.blacklisted[projectId][idx][1];
      });
      projectTotals.push({
        id: projectId,
        received: pReceived,
        rejected: pRejected,
        blacklisted: pBlacklisted,
        accepted: Math.max(0, pReceived - pRejected - pBlacklisted),
      });
    });
    this.setState({
      projectTotals,
      projectsLoading: false,
    });
  }

  render() {
    const organization = this.props.organization;

    return (
      <DocumentTitle title={`Stats - ${organization.slug} - Sentry`}>
        <OrganizationStatsDetails organization={organization} {...this.state} />
      </DocumentTitle>
    );
  }
}

export {OrganizationStatsContainer};

export default withApi(OrganizationStatsContainer);
