import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import ApiMixin from '../../mixins/apiMixin';
import {loadStats} from '../../actionCreators/projects';

import GroupStore from '../../stores/groupStore';
import ProjectsStore from '../../stores/projectsStore';
import TeamStore from '../../stores/teamStore';

import EventsPerHour from '../../components/events/eventsPerHour';
import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import OrganizationState from '../../mixins/organizationState';
import UnreleasedChanges from './unreleasedChanges';
import Resources from './resources';
import Activity from './activity';
import ProjectList from './projectList';
import ProjectListOld from './projectListOld';
import NewIssues from './newIssues';
import AssignedIssues from './assignedIssues';

const OrganizationDashboard = createReactClass({
  displayName: 'OrganizationDashboard',
  mixins: [
    ApiMixin,
    Reflux.listenTo(TeamStore, 'onTeamListChange'),
    Reflux.listenTo(ProjectsStore, 'onProjectListChange'),
    OrganizationState,
  ],

  getDefaultProps() {
    return {
      statsPeriod: '24h',
      pageSize: 5,
    };
  },

  getInitialState() {
    return {
      teams: TeamStore.getAll(),
      projects: ProjectsStore.getAll(),
    };
  },

  componentWillMount() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'generated',
        group: 'project',
      },
    });
  },

  componentWillUnmount() {
    GroupStore.reset();
  },

  onTeamListChange() {
    this.setState({
      teams: TeamStore.getAll(),
    });
  },

  onProjectListChange() {
    this.setState({
      projects: ProjectsStore.getAll(),
    });
  },

  render() {
    let org = this.getOrganization();
    let projects = org.projects;
    let showResources = false;
    if (projects.length == 1 && !projects[0].firstEvent) {
      showResources = true;
    }
    let features = new Set(org.features);

    return (
      <OrganizationHomeContainer>
        <div className="row">
          <div className="col-md-8">
            {features.has('unreleased-changes') && <UnreleasedChanges {...this.props} />}
            {showResources && <Resources org={org} project={projects[0]} />}
            {!showResources && (
              <div>
                <AssignedIssues {...this.props} />
                <NewIssues {...this.props} />
                <Activity {...this.props} />
              </div>
            )}
          </div>
          <div className="col-md-4">
            <EventsPerHour {...this.props} />
            {features.has('new-teams') ? (
              <ProjectList {...this.props} projects={this.state.projects} />
            ) : (
              <ProjectListOld {...this.props} projects={this.state.projects} />
            )}
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});

export default OrganizationDashboard;
