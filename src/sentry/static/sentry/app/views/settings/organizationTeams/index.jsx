import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {loadStats} from 'app/actionCreators/projects';
import {sortArray} from 'app/utils';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import TeamStore from 'app/stores/teamStore';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import OrganizationTeams from './organizationTeams';

const OrganizationTeamsContainer = createReactClass({
  displayName: 'OrganizationTeamsContainer',

  propTypes: {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    routes: PropTypes.arrayOf(PropTypes.object),
  },

  mixins: [
    Reflux.listenTo(TeamStore, 'onTeamListChange'),
    Reflux.listenTo(ProjectsStore, 'onProjectListChange'),
  ],

  getInitialState() {
    return {
      teamList: sortArray(TeamStore.getAll(), function (o) {
        return o && o.name;
      }),
      projectList: sortArray(ProjectsStore.getAll(), function (o) {
        return o && o.name;
      }),
      projectStats: {},
    };
  },

  componentDidMount() {
    this.fetchStats();
  },

  fetchStats() {
    loadStats(this.props.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  },

  onTeamListChange() {
    const newTeamList = TeamStore.getAll();

    this.setState({
      teamList: sortArray(newTeamList, function (o) {
        return o.name;
      }),
    });
  },

  onProjectListChange() {
    const newProjectList = ProjectsStore.getAll();

    this.setState({
      projectList: sortArray(newProjectList, function (o) {
        return o.name;
      }),
    });
  },

  render() {
    const {organization} = this.props;

    if (!organization) {
      return null;
    }

    const allTeams = this.state.teamList;
    const activeTeams = this.state.teamList.filter(team => team.isMember);

    return (
      <OrganizationTeams
        {...this.props}
        access={new Set(organization.access)}
        features={new Set(organization.features)}
        organization={organization}
        projectList={this.state.projectList}
        allTeams={allTeams}
        activeTeams={activeTeams}
      />
    );
  },
});

export {OrganizationTeamsContainer};

export default withApi(withOrganization(OrganizationTeamsContainer));
