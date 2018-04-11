import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import {Link} from 'react-router';
import {Flex} from 'grid-emotion';
import {Sparklines, SparklinesLine} from 'react-sparklines';

import ApiMixin from '../mixins/apiMixin';
import {loadStats} from '../actionCreators/projects';

import GroupStore from '../stores/groupStore';
import HookStore from '../stores/hookStore';
import ProjectsStore from '../stores/projectsStore';
import TeamStore from '../stores/teamStore';

import AsyncComponent from '../components/asyncComponent';
import ActivityFeed from '../components/activity/feed';
import ErrorRobot from '../components/errorRobot';
import EventsPerHour from '../components/events/eventsPerHour';
import IssueList from '../components/issueList';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import OrganizationState from '../mixins/organizationState';
import ResourceCard from '../components/resourceCard';
import TimeSince from '../components/timeSince';
import CommitLink from '../components/commitLink';

import {t, tct} from '../locale';
import {sortArray} from '../utils';
import {Panel, PanelBody, PanelItem} from '../components/panels';
import EmptyStateWarning from '../components/emptyStateWarning';

class UnreleasedChanges extends AsyncComponent {
  getEndpoints() {
    return [
      [
        'unreleasedCommits',
        `/organizations/${this.props.params.orgId}/members/me/unreleased-commits/`,
      ],
    ];
  }

  renderMessage = message => {
    if (!message) {
      return t('No message provided');
    }

    let firstLine = message.split(/\n/)[0];

    return firstLine;
  };

  emptyState() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>
            {t("We couldn't find any unreleased commits associated with your account.")}
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  missingEmails() {
    return (
      <Panel>
        <EmptyStateWarning>
          <p>{t("We couldn't find any commits associated with your account.")}</p>
          <p>
            <small>
              {t(
                'Have you added (and verified) the email address associated with your activity?'
              )}
            </small>
          </p>
        </EmptyStateWarning>
      </Panel>
    );
  }

  renderBody() {
    let {unreleasedCommits} = this.state;
    let {commits, errors, repositories} = unreleasedCommits;

    if (errors && errors.missing_emails) return this.missingEmails();
    if (!commits.length) return this.emptyState();
    return (
      <div className="panel panel-default">
        <ul className="list-group list-group-lg commit-list">
          {commits.map(commit => {
            let repo = repositories[commit.repositoryID];
            return (
              <li className="list-group-item" key={commit.id}>
                <div className="row row-center-vertically">
                  <div className="col-xs-10">
                    <h5 className="truncate">{this.renderMessage(commit.message)}</h5>
                    <p>
                      {repo.name} &mdash; <TimeSince date={commit.dateCreated} />
                    </p>
                  </div>
                  <div className="col-xs-2 hidden-xs align-right">
                    <CommitLink commitId={commit.id} repository={repo} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  render() {
    return (
      <div>
        <h4>{t('Unreleased Changes')}</h4>
        {this.renderComponent()}
      </div>
    );
  }
}

class Resources extends React.Component {
  render() {
    return (
      <div>
        <h4>Resources</h4>
        <Flex justify={'space-between'}>
          <Flex width={3 / 10}>
            <ResourceCard
              link={'https://blog.sentry.io/2018/03/06/the-sentry-workflow'}
              imgUrl={'images/releases.svg'}
              title={'The Sentry Workflow'}
            />
          </Flex>
          <Flex width={3 / 10}>
            <ResourceCard
              link={'https://sentry.io/vs/logging/'}
              imgUrl={'images/breadcrumbs-generic.svg'}
              title={'Sentry vs Logging'}
            />
          </Flex>
          <Flex width={3 / 10}>
            <ResourceCard
              link={'https://docs.sentry.io/'}
              imgUrl={'images/code-arguments-tags-mirrored.svg'}
              title={'Docs'}
            />
          </Flex>
        </Flex>
      </div>
    );
  }
}

class AssignedIssues extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string,
    pageSize: PropTypes.number,
  };

  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/members/me/issues/assigned/?`;
  };

  getViewMoreLink = () => {
    return `/organizations/${this.props.params.orgId}/issues/assigned/`;
  };

  renderEmpty = () => {
    return (
      <Panel>
        <PanelBody>
          <PanelItem justify="center">
            {t('No issues have been assigned to you.')}
          </PanelItem>
        </PanelBody>
      </Panel>
    );
  };

  refresh = () => {
    this.refs.issueList.remountComponent();
  };

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>
            {t('View more')}
          </Link>
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <span className="icon icon-refresh" />
          </a>
        </div>
        <h4>Assigned to me</h4>
        <IssueList
          endpoint={this.getEndpoint()}
          query={{
            statsPeriod: this.props.statsPeriod,
            per_page: this.props.pageSize,
            status: 'unresolved',
          }}
          pagination={false}
          renderEmpty={this.renderEmpty}
          ref="issueList"
          {...this.props}
        />
      </div>
    );
  }
}

class NewIssues extends React.Component {
  static propTypes = {
    statsPeriod: PropTypes.string,
    pageSize: PropTypes.number,
  };

  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/issues/new/`;
  };

  renderEmpty = () => {
    return (
      <Panel>
        <PanelBody>
          <PanelItem justify="center">
            {t('No new issues have been seen in the last week.')}
          </PanelItem>
        </PanelBody>
      </Panel>
    );
  };

  refresh = () => {
    this.refs.issueList.remountComponent();
  };

  render() {
    return (
      <div>
        <div className="pull-right">
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <span className="icon icon-refresh" />
          </a>
        </div>
        <h4>New this week</h4>
        <IssueList
          endpoint={this.getEndpoint()}
          query={{
            statsPeriod: this.props.statsPeriod,
            per_page: this.props.pageSize,
            status: 'unresolved',
          }}
          pagination={false}
          renderEmpty={this.renderEmpty}
          ref="issueList"
          {...this.props}
        />
      </div>
    );
  }
}

function ProjectSparkline(props) {
  let values = props.data.map(tuple => tuple[1]);

  return (
    <Sparklines data={values} width={100} height={32}>
      <SparklinesLine
        {...props}
        style={{stroke: '#8f85d4', fill: 'none', strokeWidth: 3}}
      />
    </Sparklines>
  );
}
ProjectSparkline.propTypes = {
  data: PropTypes.array.isRequired,
};

const ProjectListOld = createReactClass({
  displayName: 'ProjectListOld',

  propTypes: {
    projects: PropTypes.array,
    maxProjects: PropTypes.number,
  },

  mixins: [OrganizationState],

  getDefaultProps() {
    return {
      maxProjects: 8,
    };
  },

  render() {
    let org = this.getOrganization();
    let {maxProjects, projects} = this.props;

    projects = sortArray(projects, item => {
      return [!item.isBookmarked, item.team && item.team.name, item.name];
    });

    // project list is
    // a) all bookmarked projects
    // b) if bookmarked projcets < maxProjects, then fill with sorted projects until maxProjects

    let bookmarkedProjects = projects.filter(p => p.isBookmarked);
    if (bookmarkedProjects.length < maxProjects) {
      projects = bookmarkedProjects.concat(
        projects.slice(bookmarkedProjects.length, maxProjects)
      );
    } else {
      projects = bookmarkedProjects;
    }

    return (
      <div className="organization-dashboard-projects">
        <Link className="btn-sidebar-header" to={`/organizations/${org.slug}/teams/`}>
          {t('View All')}
        </Link>
        <h6 className="nav-header">{t('Projects')}</h6>
        {bookmarkedProjects.length === 0 && (
          <div className="alert alert-info" style={{marginBottom: 10}}>
            {tct('Bookmark your most used [projects:projects] to have them appear here', {
              projects: <Link to={`/organizations/${org.slug}/teams/`} />,
            })}
          </div>
        )}
        <ul className="nav nav-stacked">
          {projects.map(project => {
            return (
              <li key={project.id}>
                <div className="pull-right sparkline">
                  {project.stats && <ProjectSparkline data={project.stats} />}
                </div>
                <Link to={`/${org.slug}/${project.slug}/`}>
                  <h4>
                    {project.isBookmarked && (
                      <span className="bookmark icon-star-solid" />
                    )}
                    {project.name}
                  </h4>
                  <h5>{project.team ? project.team.name : <span>&nbsp;</span>}</h5>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

export const ProjectList = createReactClass({
  displayName: 'ProjectList',

  propTypes: {
    projects: PropTypes.array,
    maxProjects: PropTypes.number,
  },

  mixins: [OrganizationState],

  getDefaultProps() {
    return {
      maxProjects: 8,
    };
  },

  render() {
    let org = this.getOrganization();
    let {maxProjects} = this.props;

    let projects = this.props.projects.filter(p => {
      return p.isMember;
    });
    projects = sortArray(projects, item => {
      return [!item.isBookmarked, item.name];
    });

    // project list is
    // a) all bookmarked projects
    // b) if bookmarked projcets < maxProjects, then fill with sorted projects until maxProjects

    let bookmarkedProjects = projects.filter(p => p.isBookmarked);
    if (bookmarkedProjects.length < maxProjects) {
      projects = bookmarkedProjects.concat(
        projects.slice(bookmarkedProjects.length, maxProjects)
      );
    } else {
      projects = bookmarkedProjects;
    }

    return (
      <div className="organization-dashboard-projects">
        <Link className="btn-sidebar-header" to={`/organizations/${org.slug}/teams/`}>
          {t('View All')}
        </Link>
        <h6 className="nav-header">{t('Projects')}</h6>
        {bookmarkedProjects.length === 0 && (
          <div className="alert alert-info" style={{marginBottom: 10}}>
            {tct('Bookmark your most used [projects:projects] to have them appear here', {
              projects: <Link to={`/organizations/${org.slug}/teams/`} />,
            })}
          </div>
        )}
        <ul className="nav nav-stacked">
          {projects.map(project => {
            return (
              <li key={project.id} style={{clear: 'both'}}>
                <div className="pull-right sparkline">
                  {project.stats && <ProjectSparkline data={project.stats} />}
                </div>
                <Link to={`/${org.slug}/${project.slug}/`}>
                  <h4 style={{margin: '25px 0px'}}>
                    {project.isBookmarked && (
                      <span className="bookmark icon-star-solid" />
                    )}
                    {project.slug}
                  </h4>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
});

class Activity extends React.Component {
  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/activity/`;
  };

  refresh = () => {
    this.refs.activityFeed.remountComponent();
  };

  getViewMoreLink() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  }

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>
            {t('View more')}
          </Link>
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <span className="icon icon-refresh" />
          </a>
        </div>
        <h4>{t('Recent activity')}</h4>
        <ActivityFeed
          ref="activityFeed"
          endpoint={this.getEndpoint()}
          query={{
            per_page: 10,
          }}
          pagination={false}
          {...this.props}
        />
      </div>
    );
  }
}

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
    // Allow injection via getsentry et all
    let hooks = HookStore.get('organization:dashboard:secondary-column').map(cb => {
      return cb({
        params: this.props.params,
      });
    });

    return {
      teams: TeamStore.getAll(),
      projects: ProjectsStore.getAll(),
      hooks,
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
            {showResources && (
              <React.Fragment>
                <Panel>
                  <ErrorRobot org={org} project={projects[0]} />
                </Panel>
                <Resources />
              </React.Fragment>
            )}
            {!showResources && (
              <div>
                <AssignedIssues {...this.props} />
                <NewIssues {...this.props} />
                <Activity {...this.props} />
              </div>
            )}
          </div>
          <div className="col-md-4">
            {this.state.hooks}
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
