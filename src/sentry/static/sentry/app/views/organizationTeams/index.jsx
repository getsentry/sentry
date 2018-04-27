import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {loadStats} from 'app/actionCreators/projects';
import {sortArray} from 'app/utils';
import ApiMixin from 'app/mixins/apiMixin';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import getSettingsComponent from 'app/utils/getSettingsComponent';

const OrganizationTeams = createReactClass({
  displayName: 'OrganizationTeams',

  propTypes: {
    routes: PropTypes.arrayOf(PropTypes.object),
  },

  mixins: [
    ApiMixin,
    OrganizationState,
    Reflux.listenTo(TeamStore, 'onTeamListChange'),
    Reflux.listenTo(ProjectsStore, 'onProjectListChange'),
  ],

  getInitialState() {
    return {
      Component: null,
      teamList: sortArray(TeamStore.getAll(), function(o) {
        return o && o.name;
      }),
      projectList: sortArray(ProjectsStore.getAll(), function(o) {
        return o && o.name;
      }),
      projectStats: {},
    };
  },

  componentDidMount() {
    this.fetchStats();

    getSettingsComponent(
      () =>
        import(/* webpackChunkName: "organizationTeamsView" */ '../settings/team/organizationTeamsView'),
      () =>
        import(/* webpackChunkName: "organizationTeamsView.old" */ './organizationTeamsView'),
      this.props.routes
    ).then(Component => {
      this.setState({Component});
    });
  },

  fetchStats() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  },

  onTeamListChange() {
    let newTeamList = TeamStore.getAll();

    this.setState({
      teamList: sortArray(newTeamList, function(o) {
        return o.name;
      }),
    });
  },

  onProjectListChange() {
    let newProjectList = ProjectsStore.getAll();

    this.setState({
      projectList: sortArray(newProjectList, function(o) {
        return o.name;
      }),
    });
  },

  render() {
    if (!this.context.organization) return null;
    if (!this.state.Component) return <LoadingIndicator />;

    let access = this.getAccess();
    let features = this.getFeatures();
    let org = this.getOrganization();

    let allTeams = this.state.teamList;
    let activeTeams = this.state.teamList.filter(team => team.isMember);

    return (
      <this.state.Component
        {...this.props}
        access={access}
        features={features}
        organization={org}
        projectList={this.state.projectList}
        allTeams={allTeams}
        activeTeams={activeTeams}
      />
    );
  },
});

export default OrganizationTeams;
