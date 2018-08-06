import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import _ from 'lodash';

import AvatarList from 'app/components/avatar/avatarList';

import LastCommit from 'app/components/lastCommit';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingError from 'app/components/loadingError';
import TimeSince from 'app/components/timeSince';
import Hovercard from 'app/components/hovercard';

import {getShortVersion} from 'app/utils';
import {t, tct} from 'app/locale';

import ApiMixin from 'app/mixins/apiMixin';

const VersionHoverCard = createReactClass({
  displayName: 'VersionHoverCard',

  propTypes: {
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: {},
      visible: false,
      hasRepos: false,
      deploys: [],
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
    let releasePath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/`;
    this.api.request(releasePath, {
      method: 'GET',
      success: data => {
        this.setState({
          release: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
      complete: done,
    });

    // repos
    let repoPath = `/organizations/${orgId}/repos/`;
    this.api.request(repoPath, {
      method: 'GET',
      success: data => {
        this.setState({
          hasRepos: data.length > 0,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
      complete: done,
    });

    //deploys
    let deployPath = `/organizations/${orgId}/releases/${encodeURIComponent(
      version
    )}/deploys/`;
    this.api.request(deployPath, {
      method: 'GET',
      success: data => {
        this.setState({
          deploys: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      },
      complete: done,
    });
  },

  toggleHovercard() {
    this.setState({
      visible: true,
      // visible: !this.state.visible,
    });
  },

  getRepoLink() {
    let {orgId} = this.props;
    return {
      body: (
        <div className="version-hovercard blankslate m-a-0 p-x-1 p-y-1 align-center">
          <h5>Releases are better with commit data!</h5>
          <p>
            Connect a repository to see commit info, files changed, and authors involved
            in future releases.
          </p>
          <a className="btn btn-primary" href={`/organizations/${orgId}/repos/`}>
            Connect a repository
          </a>
        </div>
      ),
    };
  },

  getBody() {
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
    return {
      header: (
        <span className="truncate">
          {tct('Release [version]', {version: shortVersion})}
        </span>
      ),
      body: (
        <div>
          <div className="row row-flex">
            <div className="col-xs-4">
              <h6>{t('New Issues')}</h6>
              <div className="count-since">{release.newGroups}</div>
            </div>
            <div className="col-xs-8">
              <h6 style={{textAlign: 'right'}}>
                {release.commitCount}{' '}
                {release.commitCount !== 1 ? t('commits ') : t('commit ')} {t('by ')}{' '}
                {release.authors.length}{' '}
                {release.authors.length !== 1 ? t('authors') : t('author')}{' '}
              </h6>
              <AvatarList
                users={release.authors}
                avatarSize={25}
                tooltipOptions={{container: 'body'}}
                typeMembers={'authors'}
              />
            </div>
          </div>
          {lastCommit && <LastCommit commit={lastCommit} headerClass="commit-heading" />}
          {deploys.length > 0 && (
            <div>
              <div className="divider">
                <h6 className="deploy-heading">{t('Deploys')}</h6>
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
                          fontSize: 12,
                        }}
                      >
                        {env}
                      </strong>
                      {dateFinished && (
                        <span
                          className="text-light"
                          style={{
                            position: 'absolute',
                            left: 98,
                            width: '50%',
                            padding: '3px 0',
                          }}
                        >
                          <TimeSince date={dateFinished} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    };
  },

  render() {
    let {loading, error, hasRepos} = this.state;
    let header = null;
    let body = loading ? (
      <LoadingIndicator mini={true} />
    ) : error ? (
      <LoadingError />
    ) : null;

    if (!loading && !error) {
      let renderObj = hasRepos ? this.getBody() : this.getRepoLink();
      header = renderObj.header;
      body = renderObj.body;
    }

    return (
      <Hovercard {...this.props} header={header} body={body}>
        {this.props.children}
      </Hovercard>
    );
  },
});

export default VersionHoverCard;
