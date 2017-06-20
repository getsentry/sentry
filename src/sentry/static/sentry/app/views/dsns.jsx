import React from 'react';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';

import ApiMixin from '../mixins/apiMixin';
import AutoSelectText from '../components/autoSelectText';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const ProjectRow = React.createClass({
  propTypes: {
    onClick: React.PropTypes.func,
    org: React.PropTypes.object.isRequired,
    project: React.PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  render() {
    let {org, project} = this.props;

    return (
      <tr>
        <td>
          <h5 style={{cursor: 'pointer'}} onClick={this.props.onClick}>
            {project.name} <small>{project.team.name}</small>
          </h5>
        </td>
        <td style={{width: '32px'}}>
          <Link
            to={`/${org.slug}/${project.slug}/settings/keys/`}
            className="btn btn-sm btn-default">
            <span className="icon icon-wrench" />
          </Link>
        </td>
      </tr>
    );
  }
});

const Dsns = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      selectedProject: null,
      orgs: []
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    this.setState({
      loading: true
    });

    this.api.request('/dsns/', {
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          orgs: data
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  selectProject(projectId) {
    this.setState({
      selectedProject: this.state.selectedProject === projectId ? null : projectId
    });
  },

  renderOrg(org) {
    let children = [];
    for (let project of org.projects) {
      children.push(
        <ProjectRow
          onClick={() => this.selectProject(project.id)}
          key={project.id}
          org={org}
          project={project}
        />
      );

      if (this.state.selectedProject == project.id) {
        for (let dsn of project.dsns) {
          children.push(
            <tr key={'dsn-' + dsn.id} className="deemphasized">
              <td colSpan="2">
                <h6 className="nav-header">{dsn.name}</h6>
                <div className="form-group">
                  <label>{t('DSN')}</label>
                  <AutoSelectText className="form-control disabled">
                    {dsn.dsn.secret}
                  </AutoSelectText>
                </div>
                <div className="form-group">
                  <label>{t('DSN (Public)')}</label>
                  <AutoSelectText className="form-control disabled">
                    {dsn.dsn.public}
                  </AutoSelectText>
                </div>
              </td>
            </tr>
          );
        }
      }
    }

    return (
      <div className="panel panel-default" key={org.id}>
        <table className="table">
          <thead>
            <tr>
              <th colSpan="2">{org.name}</th>
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
      </div>
    );
  },

  renderResults() {
    let {orgs} = this.state;

    if (orgs.length === 0) {
      return (
        <ul className="nav nav-stacked">
          <li>{t('You have not created any client keys yet.')}</li>
        </ul>
      );
    }

    return (
      <div>
        {orgs.map(org => this.renderOrg(org))}
      </div>
    );
  },

  getTitle() {
    return 'Client Keys (DSN) - Sentry';
  },

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <p>
            {t('Client Keys (also called DSN) allow you to submit events to Sentry.')}
          </p>
          <p>
            {t(
              `
              These keys are manage in the project settings but for convenience
              reasons we show you all keys here that you have access to.  Click
              on a project to reveal the keys.`
            )}
          </p>

          {this.state.loading
            ? <LoadingIndicator />
            : this.state.error
                ? <LoadingError onRetry={this.fetchData} />
                : this.renderResults()}
        </div>
      </DocumentTitle>
    );
  }
});

export default Dsns;
