import React from 'react';
import _ from 'lodash';

import Avatar from './avatar';

import LastCommit from './lastCommit';
import LoadingIndicator from './loadingIndicator';
import LoadingError from './loadingError';
import TimeSince from './timeSince';

import {getShortVersion} from '../utils';
import {t} from '../locale';

import ApiMixin from '../mixins/apiMixin';

const VersionHoverCard = React.createClass({
  propTypes: {
    version: React.PropTypes.string.isRequired,
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: {},
      visible: false,
      hasRepos: false,
      deploys: []
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId, version} = this.props;
    let done = _.after(3, () => {
      this.setState({loading: false});
    });

    // releases
    let releasePath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(version)}/`;
    this.api.request(releasePath, {
      method: 'GET',
      success: data => {
        this.setState({
          release: data
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      },
      complete: done
    });

    // repos
    let repoPath = `/organizations/${orgId}/repos/`;
    this.api.request(repoPath, {
      method: 'GET',
      success: data => {
        this.setState({
          hasRepos: data.length > 0
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      },
      complete: done
    });

    //deploys
    let deployPath = `/organizations/${orgId}/releases/${encodeURIComponent(version)}/deploys/`;
    this.api.request(deployPath, {
      method: 'GET',
      success: data => {
        this.setState({
          deploys: data
        });
      },
      error: () => {
        this.setState({
          error: true
        });
      },
      complete: done
    });
  },

  toggleHovercard() {
    this.setState({
      visible: !this.state.visible
    });
  },

  renderRepoLink() {
    let {orgId} = this.props;
    return (
      <div className="version-hovercard blankslate m-a-0 p-x-1 p-y-1 align-center">
        <h5>Releases are better with commit data!</h5>
        <p>
          Connect a repository to see commit info, files changed, and authors involved in future releases.
        </p>
        <a className="btn btn-primary" href={`/organizations/${orgId}/repos/`}>
          Connect a repository
        </a>
      </div>
    );
  },

  renderBody() {
    let {release, deploys} = this.state;
    let {version} = this.props;
    let lastCommit = release.lastCommit;
    let shortVersion = getShortVersion(version);

    let recentDeploysByEnviroment = deploys.reduce(function(dbe, deploy) {
      let {dateFinished, environment} = deploy;
      if (!dbe.hasOwnProperty(environment)) {
        dbe[environment] = dateFinished;
      }

      return dbe;
    }, {});
    let mostRecentDeploySlice = Object.keys(recentDeploysByEnviroment);
    if (Object.keys(recentDeploysByEnviroment).length > 3) {
      mostRecentDeploySlice = Object.keys(recentDeploysByEnviroment).slice(0, 3);
    }
    return (
      <div>
        <div className="hovercard-header">
          <span className="truncate">Release {shortVersion}</span>
        </div>
        <div className="hovercard-body">
          <div className="row row-flex">
            <div className="col-xs-4">
              <h6>New Issues</h6>
              <div className="count">{release.newGroups}</div>
            </div>
            <div className="col-xs-8">
              <h6>
                {release.commitCount}
                {' '}
                {release.commitCount !== 1 ? t('commits ') : t('commit ')}
                {' '}
                {t('by ')}
                {' '}
                {release.authors.length}
                {' '}
                {release.authors.length !== 1 ? t('authors') : t('author')}
                {' '}
              </h6>
              <div className="avatar-grid">
                {release.authors.map((author, idx) => {
                  return (
                    <span
                      className="avatar-grid-item tip"
                      title={author.name + ' ' + author.email}
                      key={idx}>
                      <Avatar user={author} />
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
          {lastCommit && <LastCommit commit={lastCommit} headerClass="commit-heading" />}
          {deploys.length > 0 &&
            <div>
              <div className="divider">
                <h6 className="deploy-heading">Deploys</h6>
              </div>
              {mostRecentDeploySlice.map((env, idx) => {
                let dateFinished = recentDeploysByEnviroment[env];
                return (
                  <div className="deploy" key={idx}>
                    <div className="deploy-meta" style={{position: 'relative'}}>
                      <strong
                        className="repo-label truncate"
                        style={{
                          padding: 3,
                          display: 'inline-block',
                          width: 86,
                          maxWidth: 86,
                          textAlign: 'center',
                          fontSize: 12
                        }}>
                        {env}
                      </strong>
                      {dateFinished &&
                        <span
                          className="text-light"
                          style={{
                            position: 'absolute',
                            left: 98,
                            width: '50%',
                            padding: '3px 0'
                          }}>
                          <TimeSince date={dateFinished} />
                        </span>}
                    </div>
                  </div>
                );
              })}
            </div>}
        </div>
      </div>
    );
  },

  render() {
    let {visible} = this.state;
    return (
      <span onMouseEnter={this.toggleHovercard} onMouseLeave={this.toggleHovercard}>
        {this.props.children}
        {visible &&
          <div className="hovercard">
            <div className="hovercard-hoverlap" />
            {this.state.loading
              ? <div className="hovercard-body"><LoadingIndicator mini={true} /></div>
              : this.state.error
                  ? <div className="hovercard-body"><LoadingError /></div>
                  : this.state.hasRepos ? this.renderBody() : this.renderRepoLink()}
          </div>}
      </span>
    );
  }
});

export default VersionHoverCard;
