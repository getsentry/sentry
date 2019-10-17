import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t, tct} from 'app/locale';
import AvatarList from 'app/components/avatar/avatarList';
import Button from 'app/components/button';
import Hovercard from 'app/components/hovercard';
import LastCommit from 'app/components/lastCommit';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import RepoLabel from 'app/components/repoLabel';
import TimeSince from 'app/components/timeSince';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

class VersionHoverCard extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    version: PropTypes.string.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
  };

  state = {
    loading: true,
    error: false,
    data: {},
    visible: false,
    hasRepos: false,
    deploys: [],
    release: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  async fetchData() {
    const {api, orgId, projectId, version} = this.props;

    // releases
    const releasePath = `/projects/${orgId}/${projectId}/releases/${encodeURIComponent(
      version
    )}/`;
    const releaseRequest = api.requestPromise(releasePath, {
      method: 'GET',
    });

    // repos
    const repoRequest = api.requestPromise(`/organizations/${orgId}/repos/`, {
      method: 'GET',
    });

    //deploys
    const deployPath = `/organizations/${orgId}/releases/${encodeURIComponent(
      version
    )}/deploys/`;
    const deployRequest = api.requestPromise(deployPath, {
      method: 'GET',
    });

    try {
      const [release, repos, deploys] = await Promise.all([
        releaseRequest,
        repoRequest,
        deployRequest,
      ]);
      this.setState({
        release,
        deploys,
        hasRepos: repos.length > 0,
        loading: false,
      });
    } catch (e) {
      this.setState({error: true});
    }
  }

  toggleHovercard() {
    this.setState({
      visible: true,
    });
  }

  getRepoLink() {
    const {orgId} = this.props;
    return {
      body: (
        <ConnectRepo>
          <h5>{t('Releases are better with commit data!')}</h5>
          <p>
            {t(
              'Connect a repository to see commit info, files changed, and authors involved in future releases.'
            )}
          </p>
          <Button href={`/organizations/${orgId}/repos/`} priority="primary">
            {t('Connect a repository')}
          </Button>
        </ConnectRepo>
      ),
    };
  }

  getBody() {
    const {release, deploys} = this.state;
    const {version} = this.props;
    const lastCommit = release.lastCommit;

    const recentDeploysByEnviroment = deploys.reduce(function(dbe, deploy) {
      const {dateFinished, environment} = deploy;
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
      header: <span className="truncate">{tct('Release [version]', {version})}</span>,
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
                typeMembers="authors"
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
                const dateFinished = recentDeploysByEnviroment[env];
                return (
                  <div className="deploy" key={idx}>
                    <div className="deploy-meta" style={{position: 'relative'}}>
                      <VersionRepoLabel>{env}</VersionRepoLabel>
                      {dateFinished && <StyledTimeSince date={dateFinished} />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ),
    };
  }

  render() {
    const {loading, error, hasRepos, release} = this.state;
    let header = null;
    let body = null;
    if (loading) {
      body = <LoadingIndicator mini />;
    } else if (error) {
      body = <LoadingError />;
    } else {
      const renderObj = hasRepos && release ? this.getBody() : this.getRepoLink();
      header = renderObj.header;
      body = renderObj.body;
    }

    return (
      <Hovercard {...this.props} header={header} body={body}>
        {this.props.children}
      </Hovercard>
    );
  }
}

export {VersionHoverCard};

export default withApi(VersionHoverCard);

const ConnectRepo = styled('div')`
  padding: ${space(2)};
  text-align: center;
`;

const VersionRepoLabel = styled(RepoLabel)`
  width: 86px;
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray2};
  position: absolute;
  left: 98px;
  width: 50%;
  padding: 3px 0;
`;
