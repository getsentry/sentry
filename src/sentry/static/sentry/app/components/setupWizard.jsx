import PropTypes from 'prop-types';
import React from 'react';
import {Client} from '../api';
import LoadingIndicator from './loadingIndicator';

class SetupWizard extends React.Component {
  static propTypes = {
    hash: PropTypes.string.isRequired,
  };

  static defaultProps = {
    hash: false,
  };

  constructor(props, context) {
    super(props, context);

    this.state = this.getDefaultState();
  }

  componentWillMount() {
    this.api = new Client();

    this.fetchOrganizations()
      .then(organizations => {
        let projectPromises = [];
        organizations.map(organization => {
          projectPromises.push(this.fetchProjects(organization));
        });
        return Promise.all(projectPromises);
      })
      .then(projectsResult => {
        let keysPromises = [];
        projectsResult.forEach(projects => {
          projects.forEach(project => {
            keysPromises.push(this.fetchKeys(project));
          });
        });
        return Promise.all(keysPromises);
      })
      .then(finishesProjects => {
        this.fetchApiKeys().then(apiKeys => {
          this.pushWizardData({projects: finishesProjects, apiKeys}).then(() => {
            let log = this.state.log;
            log.push('Waiting for Wizard to complete');
            this.setState({
              log,
            });
            this.pollFinished();
          });
        });
      });
  }

  getDefaultState() {
    return {
      log: [],
      finished: false,
    };
  }

  pollFinished() {
    return new Promise((resolve, reject) => {
      this.api.request(`/wizard/${this.props.hash}/`, {
        method: 'GET',
        success: data => {
          setTimeout(() => this.pollFinished(), 1000);
        },
        error: err => {
          resolve();
          this.setState({
            finished: true,
          });
          setTimeout(() => window.close(), 10000);
        },
      });
    });
  }

  pushWizardData(wizardData) {
    let log = this.state.log;
    log.push('Caching results');
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request(`/wizard/secure/${this.props.hash}/`, {
        method: 'POST',
        data: wizardData,
        success: data => {
          resolve();
        },
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  createApiKey() {
    let log = this.state.log;
    log.push('No API key found, creating');
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request('/api-tokens/', {
        method: 'POST',
        data: {scopes: ['project:releases']},
        success: data => resolve(data),
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  fetchApiKeys(newResolve) {
    let log = this.state.log;
    log.push('Fetching API keys');
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request('/api-tokens/', {
        method: 'GET',
        success: data => {
          if (data.length === 0) {
            this.createApiKey().then(() => {
              this.fetchApiKeys(resolve);
            });
          } else if (newResolve) {
            newResolve(resolve);
            resolve(data);
          } else {
            resolve(data);
          }
        },
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  fetchKeys(project) {
    let log = this.state.log;
    log.push(`Fetching keys for ${project.organization.name}/${project.name}`);
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request(`/projects/${project.organization.slug}/${project.slug}/keys/`, {
        method: 'GET',
        success: data => {
          log = this.state.log;
          log.push(
            `Fetched ${data.length} key(s) for ${project.organization
              .name}/${project.name}`
          );
          this.setState({
            log,
          });
          resolve({...project, keys: data});
        },
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  fetchProjects(organization) {
    let log = this.state.log;
    log.push(`Fetching projects for ${organization.name}`);
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${organization.slug}/projects/`, {
        method: 'GET',
        success: data => {
          log = this.state.log;
          log.push(`Fetched ${data.length} project(s) for ${organization.name}`);
          this.setState({
            log,
          });
          resolve(
            data.map(project => {
              return {...project, organization};
            })
          );
        },
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  fetchOrganizations() {
    let log = this.state.log;
    log.push('Fetching organizations');
    this.setState({
      log,
    });
    return new Promise((resolve, reject) => {
      this.api.request('/organizations/', {
        method: 'GET',
        success: data => {
          log = this.state.log;
          log.push(`Fetched ${data.length} organization(s)`);
          this.setState({
            log,
          });
          resolve(data);
        },
        error: err => {
          let error = (err.responseJSON && err.responseJSON.detail) || true;
          reject(error);
        },
      });
    });
  }

  renderSuccess() {
    return (
      <div className="row">
        <h3>Success!</h3>
        <h3>Return to your terminal to complete your setup</h3>
        <h5>(This window will close in 10 sec)</h5>
        <button className="btn btn-default" onClick={() => window.close()}>
          Close browser tab
        </button>
        <br />
        <br />
      </div>
    );
  }

  renderLog() {
    return (
      <ul>
        {this.state.log.map((log, index) => {
          return (
            <li key={index}>
              <div className="pull-left col-md-10">{log}</div>
              <div className="pull-right col-md-2">
                {index + 1 == this.state.log.length && !this.state.finished ? (
                  <LoadingIndicator mini={true} />
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  render() {
    return (
      <div className="container">
        {this.state.finished ? this.renderSuccess() : this.renderLog()}
      </div>
    );
  }
}

export default SetupWizard;
