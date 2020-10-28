import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
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
import withRelease from 'app/utils/withRelease';
import withRepositories from 'app/utils/withRepositories';
import Clipboard from 'app/components/clipboard';
import {IconCopy} from 'app/icons';
import Version from 'app/components/version';
import {Client} from 'app/api';
import {Deploy, Release, Repository} from 'app/types';

type Props = {
  api: Client;
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;

  release?: Release;
  releaseLoading?: boolean;
  releaseError?: Error;
  deploys?: Array<Deploy>;
  deploysLoading?: boolean;
  deploysError?: Error;
  repositories?: Array<Repository>;
  repositoriesLoading?: boolean;
  repositoriesError?: Error;
};
type State = {
  visible: boolean;
};

class VersionHoverCard extends React.Component<Props, State> {
  state: State = {
    visible: false,
  };

  toggleHovercard() {
    this.setState({
      visible: true,
    });
  }

  getRepoLink() {
    const {orgSlug} = this.props;
    return {
      header: null,
      body: (
        <ConnectRepo>
          <h5>{t('Releases are better with commit data!')}</h5>
          <p>
            {t(
              'Connect a repository to see commit info, files changed, and authors involved in future releases.'
            )}
          </p>
          <Button href={`/organizations/${orgSlug}/repos/`} priority="primary">
            {t('Connect a repository')}
          </Button>
        </ConnectRepo>
      ),
    };
  }

  getBody() {
    const {releaseVersion, release, deploys} = this.props;
    if (release === undefined || deploys === undefined) {
      return {header: null, body: null};
    }

    const {lastCommit} = release;
    const recentDeploysByEnvironment = deploys.reduce(function (dbe, deploy) {
      const {dateFinished, environment} = deploy;
      if (!dbe.hasOwnProperty(environment)) {
        dbe[environment] = dateFinished;
      }

      return dbe;
    }, {});
    let mostRecentDeploySlice = Object.keys(recentDeploysByEnvironment);

    if (Object.keys(recentDeploysByEnvironment).length > 3) {
      mostRecentDeploySlice = Object.keys(recentDeploysByEnvironment).slice(0, 3);
    }

    return {
      header: (
        <HeaderWrapper>
          {t('Release')}
          <VersionWrapper>
            <StyledVersion version={releaseVersion} truncate anchor={false} />

            <Clipboard value={releaseVersion}>
              <ClipboardIconWrapper>
                <IconCopy size="xs" />
              </ClipboardIconWrapper>
            </Clipboard>
          </VersionWrapper>
        </HeaderWrapper>
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
                tooltipOptions={{container: 'body'} as any}
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
                const dateFinished = recentDeploysByEnvironment[env];
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
    const {
      deploysLoading,
      deploysError,
      release,
      releaseLoading,
      releaseError,
      repositories,
      repositoriesLoading,
      repositoriesError,
    } = this.props;
    let header: React.ReactNode = null;
    let body: React.ReactNode = null;

    const loading = !!(deploysLoading || releaseLoading || repositoriesLoading);
    const error = deploysError ?? releaseError ?? repositoriesError;
    const hasRepos = repositories && repositories.length > 0;

    if (loading) {
      body = <LoadingIndicator mini />;
    } else if (error) {
      body = <LoadingError />;
    } else {
      const renderObj: {[key: string]: React.ReactNode} =
        hasRepos && release ? this.getBody() : this.getRepoLink();
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
export default withApi(withRelease(withRepositories(VersionHoverCard)));

const ConnectRepo = styled('div')`
  padding: ${space(2)};
  text-align: center;
`;

const VersionRepoLabel = styled(RepoLabel)`
  width: 86px;
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray500};
  position: absolute;
  left: 98px;
  width: 50%;
  padding: 3px 0;
`;

const HeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
const VersionWrapper = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
`;
const StyledVersion = styled(Version)`
  margin-right: ${space(0.5)};
  max-width: 190px;
`;
const ClipboardIconWrapper = styled('span')`
  &:hover {
    cursor: pointer;
  }
`;
