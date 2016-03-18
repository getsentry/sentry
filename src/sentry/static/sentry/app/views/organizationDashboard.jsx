import React from 'react';
import Reflux from 'reflux';
import {Link} from 'react-router';
import {Sparklines, SparklinesLine} from 'react-sparklines';

import ApiMixin from '../mixins/apiMixin';
import {loadStats} from '../actionCreators/projects';

import GroupStore from '../stores/groupStore';
import TeamStore from '../stores/teamStore';

import ActivityFeed from '../components/activity/feed';
import IssueList from '../components/issueList';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import OrganizationState from '../mixins/organizationState';

import {t} from '../locale';
import {sortArray} from '../utils';

const AssignedIssues = React.createClass({
  propTypes: {
    statsPeriod: React.PropTypes.string,
    pageSize: React.PropTypes.number
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/?`;
  },

  getViewMoreLink() {
    return `/organizations/${this.props.params.orgId}/issues/assigned/`;
  },

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>{t('View more')}</Link>
        </div>
        <h3>Assigned to me</h3>
        <IssueList endpoint={this.getEndpoint()} query={{
          statsPeriod: this.props.statsPeriod,
          per_page: this.props.pageSize,
          status: 'unresolved',
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});

const NewIssues = React.createClass({
  propTypes: {
    statsPeriod: React.PropTypes.string,
    pageSize: React.PropTypes.number
  },

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/issues/new/`;
  },

  render() {
    return (
      <div>
        <h3>New</h3>
        <IssueList endpoint={this.getEndpoint()} query={{
          statsPeriod: this.props.statsPeriod,
          per_page: this.props.pageSize,
          status: 'unresolved',
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});

function ProjectSparkline(props) {
  let values = props.data.map(tuple => tuple[1]);

  return (
    <Sparklines data={values} width={100} height={32}>
      <SparklinesLine {...props} style={{stroke: '#25A6F7', fill: 'none', strokeWidth: 3}}/>
    </Sparklines>
  );
}
ProjectSparkline.propTypes = {
  data: React.PropTypes.array.isRequired
};

const ProjectList = React.createClass({
  propTypes: {
    teams: React.PropTypes.array,
    maxProjects: React.PropTypes.number
  },

  mixins: [OrganizationState],

  getDefaultProps() {
    return {
      maxProjects: 5
    };
  },

  render() {
    let org = this.getOrganization();
    let {maxProjects} = this.props;
    let projects = [];
    this.props.teams.forEach(team => {
      team.projects.forEach(project => {
        projects.push({...project, teamName: team.name});
      });
    });

    projects = sortArray(projects, (item) => {
      return [!item.isBookmarked, item.teamName, item.name];
    });

    // project list is
    // a) all bookmarked projects
    // b) if bookmarked projcets < maxProjects, then fill with sorted projects until maxProjects

    let bookmarkedProjects = projects.filter(p => p.isBookmarked);
    if (bookmarkedProjects.length < maxProjects) {
      projects = bookmarkedProjects.concat(projects.slice(bookmarkedProjects.length, maxProjects));
    } else {
      projects = bookmarkedProjects;
    }

    return (
      <div className="organization-dashboard-projects">
        <Link className="btn-sidebar-header" to={`/${org.slug}/`}>View All</Link>
        <h6 className="nav-header">Projects</h6>
        <ul className="nav nav-stacked">
          {projects.map((project) => {
            return (
              <li key={project.id}>
                <div className="pull-right sparkline">
                  {project.stats &&
                    <ProjectSparkline data={project.stats}/>
                  }
                </div>
                <Link to={`/${org.slug}/${project.slug}/`}>
                  <h4>
                    {project.isBookmarked &&  <span className="bookmark icon-star-solid"></span>}
                    {project.name}
                  </h4>
                  <h5>{project.teamName}</h5>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

const Activity = React.createClass({

  getEndpoint() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  },

  render() {
    return (
      <div>
        <h6 className="nav-header">Activity</h6>
        <ActivityFeed endpoint={this.getEndpoint()} query={{
          per_page: 10,
        }} pagination={false} {...this.props} />
      </div>
    );
  },
});

const OrganizationDashboard = React.createClass({
  mixins: [
    ApiMixin,
    Reflux.listenTo(TeamStore, 'onTeamListChange'),
  ],

  getDefaultProps() {
    return {
      statsPeriod: '24h',
      pageSize: 5
    };
  },

  getInitialState() {
    return {
      teams: TeamStore.getAll()
    };
  },

  componentWillMount() {
    loadStats(this.api, {
      orgId: this.props.params.orgId,
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'received',
        group: 'project'
      }
    });
  },

  componentWillUnmount() {
    GroupStore.reset();
  },


  onTeamListChange() {
    this.setState({
      teams: TeamStore.getAll()
    });
  },

  render() {
    return (
      <OrganizationHomeContainer>
        <div className="early-adopter-banner"><strong>Psst!</strong> This feature is still a work-in-progress. Thanks for being an early adopter!</div>
        <div className="row">
          <div className="col-md-8">
            <AssignedIssues {...this.props} />
            <NewIssues {...this.props} />
          </div>
          <div className="col-md-4">
            <ProjectList {...this.props} teams={this.state.teams} />
            <Activity {...this.props} />
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  },
});

export default OrganizationDashboard;
