import {useMemo} from 'react';
import styled from '@emotion/styled';

import {AvatarList} from '@sentry/scraps/avatar';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
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

interface BodyProps {
  organization: Organization;
  projectSlug: string;
  releaseVersion: string;
}

function VersionHoverCardBody({organization, releaseVersion, projectSlug}: BodyProps) {
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
    return (
      <ConnectRepo>
        <h5>{t('Releases are better with commit data!')}</h5>
        <p>
          {t(
            'Connect a repository to see commit info, files changed, and authors involved in future releases.'
          )}
        </p>
        <LinkButton to={`/settings/${orgSlug}/repos/`} priority="primary">
          {t('Connect a repository')}
        </LinkButton>
      </ConnectRepo>
    );
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
      return null;
    }

    const parsedVersion = parseVersion(releaseVersion);
    const recentDeploysByEnvironment = deploys
      .toSorted(
        // Sorted by most recent deploy first
        (a, b) => new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
      )
      .slice(0, 3);

    return (
      <Flex direction="column" gap="xl">
        <Flex gap="xl" justify="between">
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
          <Flex direction="column" gap="xl" justify="between">
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
                  {release.commitCount === 1 ? t('commit ') : t('commits ')} {t('by ')}{' '}
                  {release.authors.length}{' '}
                  {release.authors.length === 1 ? t('author') : t('authors')}{' '}
                </h6>
                <AvatarListContainer>
                  <AvatarList
                    users={authors}
                    avatarSize={25}
                    tooltipOptions={{container: 'body'} as any}
                    typeAvatars="authors"
                  />
                </AvatarListContainer>
              </div>
            ) : null}
          </Flex>
        )}
        {release.lastCommit && <LastCommit commit={release.lastCommit} />}
        {deploys.length > 0 && (
          <Flex direction="column" gap="xs">
            <h6>{t('Deploys')}</h6>
            {recentDeploysByEnvironment.map(deploy => {
              return (
                <Flex key={deploy.id} align="center" gap="md" justify="between">
                  <Tag variant="info">{deploy.environment}</Tag>
                  {deploy.dateFinished && <StyledTimeSince date={deploy.dateFinished} />}
                </Flex>
              );
            })}
          </Flex>
        )}
      </Flex>
    );
  }

  const loading = isDeploysLoading || isReleaseLoading || isRepositoriesLoading;
  const error = isDeploysError ?? isReleaseError ?? isRepositoriesError;
  const hasRepos = repositories && repositories.length > 0;

  if (loading) {
    return (
      <Flex justify="center">
        <LoadingIndicator mini />
      </Flex>
    );
  }
  if (error) {
    return <LoadingError />;
  }

  return hasRepos && release ? getBody() : getRepoLink();
}

interface Props extends React.ComponentProps<typeof Hovercard>, BodyProps {}

function VersionHoverCard({
  organization,
  projectSlug,
  releaseVersion,
  ...hovercardProps
}: Props) {
  return (
    <Hovercard
      {...hovercardProps}
      header={<VersionHoverHeader releaseVersion={releaseVersion} />}
      body={
        <VersionHoverCardBody
          organization={organization}
          projectSlug={projectSlug}
          releaseVersion={releaseVersion}
        />
      }
    />
  );
}

interface VersionHoverHeaderProps {
  releaseVersion: string;
}

function VersionHoverHeader({releaseVersion}: VersionHoverHeaderProps) {
  return (
    <Flex align="center" gap="xs">
      {t('Release:')}
      <VersionWrapper>
        <StyledVersion version={releaseVersion} truncate anchor={false} />
        <CopyToClipboardButton
          borderless
          size="zero"
          text={releaseVersion}
          aria-label={t('Copy release version to clipboard')}
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
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const VersionWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  justify-content: flex-end;
`;

const StyledVersion = styled(Version)`
  max-width: 190px;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const CountSince = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.fontSize.xl};
`;

const AvatarListContainer = styled('div')`
  display: flex;
  padding-left: ${space(0.5)};
`;
