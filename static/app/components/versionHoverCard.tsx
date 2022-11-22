import {Component} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import AvatarList from 'sentry/components/avatar/avatarList';
import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import {Divider, Hovercard} from 'sentry/components/hovercard';
import LastCommit from 'sentry/components/lastCommit';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import RepoLabel from 'sentry/components/repoLabel';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Deploy, Organization, Release, Repository} from 'sentry/types';
import {defined} from 'sentry/utils';
import withApi from 'sentry/utils/withApi';
import withRelease from 'sentry/utils/withRelease';
import withRepositories from 'sentry/utils/withRepositories';

interface Props extends React.ComponentProps<typeof Hovercard> {
  api: Client;
  organization: Organization;
  projectSlug: string;

  releaseVersion: string;
  deploys?: Array<Deploy>;
  deploysError?: Error;
  deploysLoading?: boolean;
  release?: Release;
  releaseError?: Error;
  releaseLoading?: boolean;
  repositories?: Array<Repository>;
  repositoriesError?: Error;
  repositoriesLoading?: boolean;
}

type State = {
  visible: boolean;
};

class VersionHoverCard extends Component<Props, State> {
  state: State = {
    visible: false,
  };

  toggleHovercard() {
    this.setState({
      visible: true,
    });
  }

  getRepoLink() {
    const {organization} = this.props;
    const orgSlug = organization.slug;
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
    if (release === undefined || !defined(deploys)) {
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
      header: <VersionHoverHeader releaseVersion={releaseVersion} />,
      body: (
        <div>
          <div className="row">
            <div className="col-xs-4">
              <h6>{t('New Issues')}</h6>
              <CountSince>{release.newGroups}</CountSince>
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
          {lastCommit && <StyledLastCommit commit={lastCommit} />}
          {deploys.length > 0 && (
            <div>
              <Divider>
                <h6>{t('Deploys')}</h6>
              </Divider>
              {mostRecentDeploySlice.map((env, idx) => {
                const dateFinished = recentDeploysByEnvironment[env];
                return (
                  <DeployWrap key={idx}>
                    <VersionRepoLabel>{env}</VersionRepoLabel>
                    {dateFinished && <StyledTimeSince date={dateFinished} />}
                  </DeployWrap>
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

interface VersionHoverHeaderProps {
  releaseVersion: string;
}

export class VersionHoverHeader extends Component<VersionHoverHeaderProps> {
  render() {
    return (
      <HeaderWrapper>
        {t('Release')}
        <VersionWrapper>
          <StyledVersion version={this.props.releaseVersion} truncate anchor={false} />

          <Clipboard value={this.props.releaseVersion}>
            <ClipboardIconWrapper>
              <IconCopy data-test-id="version-hover-header-copy-icon" size="xs" />
            </ClipboardIconWrapper>
          </Clipboard>
        </VersionWrapper>
      </HeaderWrapper>
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
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
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

const CountSince = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.headerFontSize};
`;

const StyledLastCommit = styled(LastCommit)`
  margin-top: ${space(2)};
`;

const DeployWrap = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${space(1)};
  justify-items: start;
  align-items: center;
`;
