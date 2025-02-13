import {useMemo} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import Tag from 'sentry/components/badge/tag';
import {LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {Hovercard} from 'sentry/components/hovercard';
import LastCommit from 'sentry/components/lastCommit';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils';
import {uniqueId} from 'sentry/utils/guid';
import {useDeploys} from 'sentry/utils/useDeploys';
import {useRelease} from 'sentry/utils/useRelease';
import {useRepositories} from 'sentry/utils/useRepositories';
import {parseVersion} from 'sentry/utils/versions/parseVersion';

interface Props extends React.ComponentProps<typeof Hovercard> {
  organization: Organization;
  projectSlug: string;
  releaseVersion: string;
}

function VersionHoverCard({
  organization,
  projectSlug,
  releaseVersion,
  ...hovercardProps
}: Props) {
  const {
    data: repositories,
    isPending: isRepositoriesLoading,
    isError: isRepositoriesError,
  } = useRepositories({orgSlug: organization.slug});
  const {
    data: release,
    isPending: isReleaseLoading,
    isError: isReleaseError,
  } = useRelease({
    orgSlug: organization.slug,
    projectSlug,
    releaseVersion,
  });
  const {
    data: deploys,
    isPending: isDeploysLoading,
    isError: isDeploysError,
  } = useDeploys({
    orgSlug: organization.slug,
    releaseVersion,
  });

  function getRepoLink() {
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
          <LinkButton to={`/organizations/${orgSlug}/repos/`} priority="primary">
            {t('Connect a repository')}
          </LinkButton>
        </ConnectRepo>
      ),
    };
  }

  const authors = useMemo(
    () =>
      release?.authors.map<Actor | User>(author =>
        // Add a unique id if missing
        ({
          ...author,
          type: 'user',
          id: 'id' in author ? author.id : uniqueId(),
        })
      ),
    [release?.authors]
  );

  function getBody() {
    if (release === undefined || !defined(deploys)) {
      return {header: null, body: null};
    }

    const parsedVersion = parseVersion(releaseVersion);
    const recentDeploysByEnvironment = deploys
      .toSorted(
        // Sorted by most recent deploy first
        (a, b) => new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
      )
      .slice(0, 3);

    return {
      header: <VersionHoverHeader releaseVersion={releaseVersion} />,
      body: (
        <Flex column gap={space(2)}>
          <Flex gap={space(2)} justify="space-between">
            <div>
              <h6>{t('New Issues')}</h6>
              <CountSince>{release.newGroups}</CountSince>
            </div>
            <div>
              <h6 style={{textAlign: 'right'}}>{t('Date Created')}</h6>
              <DateTime date={release.dateCreated} seconds={false} />
            </div>
          </Flex>
          {parsedVersion?.package && (
            <Flex column gap={space(2)} justify="space-between">
              {parsedVersion.package && (
                <div>
                  <h6>{t('Package')}</h6>
                  <div>{parsedVersion.package}</div>
                </div>
              )}
              {release.commitCount > 0 ? (
                <div>
                  <h6>
                    {release.commitCount}{' '}
                    {release.commitCount !== 1 ? t('commits ') : t('commit ')} {t('by ')}{' '}
                    {release.authors.length}{' '}
                    {release.authors.length !== 1 ? t('authors') : t('author')}{' '}
                  </h6>
                  <AvatarList
                    users={authors}
                    avatarSize={25}
                    tooltipOptions={{container: 'body'} as any}
                    typeAvatars="authors"
                  />
                </div>
              ) : null}
            </Flex>
          )}
          {release.lastCommit && <LastCommit commit={release.lastCommit} />}
          {deploys.length > 0 && (
            <Flex column gap={space(0.5)}>
              <h6>{t('Deploys')}</h6>
              {recentDeploysByEnvironment.map(deploy => {
                return (
                  <Flex
                    key={deploy.id}
                    align="center"
                    gap={space(1)}
                    justify="space-between"
                  >
                    <Tag type="highlight" textMaxWidth={150}>
                      {deploy.environment}
                    </Tag>
                    {deploy.dateFinished && (
                      <StyledTimeSince date={deploy.dateFinished} />
                    )}
                  </Flex>
                );
              })}
            </Flex>
          )}
        </Flex>
      ),
    };
  }

  let header: React.ReactNode = null;
  let body: React.ReactNode = null;

  const loading = !!(isDeploysLoading || isReleaseLoading || isRepositoriesLoading);
  const error = isDeploysError ?? isReleaseError ?? isRepositoriesError;
  const hasRepos = repositories && repositories.length > 0;

  if (loading) {
    body = <LoadingIndicator mini />;
  } else if (error) {
    body = <LoadingError />;
  } else {
    const renderObj: {body: React.ReactNode; header: React.ReactNode} =
      hasRepos && release ? getBody() : getRepoLink();
    header = renderObj.header;
    body = renderObj.body;
  }

  return <Hovercard {...hovercardProps} header={header} body={body} />;
}

interface VersionHoverHeaderProps {
  releaseVersion: string;
}

function VersionHoverHeader({releaseVersion}: VersionHoverHeaderProps) {
  return (
    <Flex align="center" gap={space(0.5)}>
      {t('Release:')}
      <VersionWrapper>
        <StyledVersion version={releaseVersion} truncate anchor={false} />
        <CopyToClipboardButton
          borderless
          iconSize="xs"
          size="zero"
          text={releaseVersion}
        />
      </VersionWrapper>
    </Flex>
  );
}

export default VersionHoverCard;

const ConnectRepo = styled('div')`
  padding: ${space(2)};
  text-align: center;
`;

const StyledTimeSince = styled(TimeSince)`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const VersionWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  justify-content: flex-end;
`;

const StyledVersion = styled(Version)`
  max-width: 190px;
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const CountSince = styled('div')`
  color: ${p => p.theme.headingColor};
  font-size: ${p => p.theme.headerFontSize};
`;
