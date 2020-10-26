import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import DocumentTitle from 'react-document-title';

import withApi from 'app/utils/withApi';
import LazyLoad from 'app/components/lazyLoad';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';

class OrganizationStatsContainer extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    routes: PropTypes.array.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  constructor(props) {
    super(props);
    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 7;

    this.state = {
      projectsError: null,
      projectsLoading: false,
      projectsRequestsPending: 0,
      statsError: null,
      statsLoading: false,
      statsRequestsPending: 0,
      projectMap: null,
      rawProjectData: {received: null, rejected: null, blacklisted: null},
      rawOrgData: {received: null, rejected: null, blacklisted: null},
      orgStats: null,
      orgTotal: null,
      projectTotals: null,
      querySince: since,
      queryUntil: until,
    };
  }

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
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

  componentDidUpdate(prevProps) {
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
        const projectMap = {};
        data.forEach(project => {
          projectMap[project.id] = project;
        });

        this.setState(prevState => ({
          pageLinks: jqxhr.getResponseHeader('Link'),
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

    $.each(this.state.rawOrgData, statName => {
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

    $.each(this.state.rawProjectData, statName => {
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
    const orgPoints = []; // accepted, rejected, blacklisted
    const aReceived = [0, 0]; // received, points
    const rawOrgData = this.state.rawOrgData;
    $.each(rawOrgData.received, (idx, point) => {
      const dReceived = point[1];
      const dRejected = rawOrgData.rejected[idx][1];
      const dBlacklisted = rawOrgData.blacklisted[idx][1];
      const dAccepted = Math.max(0, dReceived - dRejected - dBlacklisted);
      orgPoints.push({
        x: point[0],
        y: [dAccepted, dRejected, dBlacklisted],
      });
      oReceived += dReceived;
      oRejected += dRejected;
      oBlacklisted += dBlacklisted;
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });
    this.setState({
      orgStats: orgPoints,
      orgTotal: {
        received: oReceived,
        rejected: oRejected,
        blacklisted: oBlacklisted,
        accepted: Math.max(0, oReceived - oRejected - oBlacklisted),
        avgRate: aReceived[1] ? parseInt(aReceived[0] / aReceived[1] / 60, 10) : 0,
      },
      statsLoading: false,
    });
  }

  processProjectData() {
    const rawProjectData = this.state.rawProjectData;
    const projectTotals = [];
    $.each(rawProjectData.received, (projectId, data) => {
      let pReceived = 0;
      let pRejected = 0;
      let pBlacklisted = 0;
      $.each(data, (idx, point) => {
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
        <LazyLoad
          component={() =>
            import(
              /* webpackChunkName: "organizationStats" */ './organizationStatsDetails'
            ).then(mod => mod.default)
          }
          organization={organization}
          {...this.state}
        />
      </DocumentTitle>
    );
  }
}

export {OrganizationStatsContainer};

export default withApi(withOrganization(OrganizationStatsContainer));
