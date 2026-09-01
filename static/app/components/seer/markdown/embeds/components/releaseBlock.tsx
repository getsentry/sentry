import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {AvatarList, UserAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CommitLink} from 'sentry/components/commitLink';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {t, tct} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {ReleaseWithHealth} from 'sentry/types/release';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {deploysApiOptions} from 'sentry/utils/deploysApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {parseVersion} from 'sentry/utils/versions/parseVersion';

import {ReleaseLink} from './releaseLink';

type ReleaseData = EmbedOutput<'release'>;

function releaseEmbedApiOptions({
  organizationSlug,
  version,
}: {
  organizationSlug: string;
  version: string;
}) {
  return apiOptions.as<ReleaseWithHealth>()(
    '/organizations/$organizationIdOrSlug/releases/$version/',
    {
      path: {organizationIdOrSlug: organizationSlug, version},
      staleTime: 30_000,
    }
  );
}

function getCommitSummary(commitCount: number, authorCount: number) {
  if (authorCount === 0) {
    return commitCount === 1
      ? t('1 commit')
      : tct('[commitCount] commits', {commitCount});
  }

  if (commitCount === 1) {
    return authorCount === 1
      ? t('1 commit by 1 author')
      : tct('1 commit by [authorCount] authors', {authorCount});
  }

  return authorCount === 1
    ? tct('[commitCount] commits by 1 author', {commitCount})
    : tct('[commitCount] commits by [authorCount] authors', {
        authorCount,
        commitCount,
      });
}

export function ReleaseBlock({version, projectId}: ReleaseData) {
  const organization = useOrganization();
  const releaseQuery = useQuery(
    releaseEmbedApiOptions({organizationSlug: organization.slug, version})
  );
  const deploysQuery = useQuery(
    deploysApiOptions({
      orgSlug: organization.slug,
      releaseVersion: version,
      query: projectId === undefined ? undefined : {project: projectId},
    })
  );
  const release = releaseQuery.data;
  const authors = useMemo(
    () =>
      release?.authors.map<Actor | User>((author, index) => ({
        ...author,
        type: 'user',
        id: 'id' in author ? author.id : `${author.email}-${index}`,
      })) ?? [],
    [release?.authors]
  );
  const recentDeploys = useMemo(
    () =>
      deploysQuery.data
        ?.toSorted(
          (a, b) =>
            new Date(b.dateFinished).getTime() - new Date(a.dateFinished).getTime()
        )
        .slice(0, 3) ?? [],
    [deploysQuery.data]
  );
  const packageName =
    release?.versionInfo?.package ?? parseVersion(release?.version ?? version)?.package;
  const newGroups =
    release && projectId !== undefined
      ? (release.projects.find(project => String(project.id) === String(projectId))
          ?.newGroups ?? 0)
      : (release?.newGroups ?? 0);
  const lastCommitTitle = release?.lastCommit?.message?.split(/\r?\n/, 1)[0];
  const sectionCount =
    4 + Number((release?.commitCount ?? 0) > 0) + Number(Boolean(release?.lastCommit));

  return (
    <Container
      background="primary"
      border="primary"
      containerType="inline-size"
      data-test-id="seer-release-embed"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="lg">
        <Flex align="center" gap="sm" justify="between">
          <ReleaseLink version={version} projectId={projectId} />
          <CopyToClipboardButton
            aria-label={t('Copy release version to clipboard')}
            size="zero"
            text={version}
            variant="transparent"
          />
        </Flex>

        {releaseQuery.isPending ? (
          <Flex justify="center" padding="md">
            <LoadingIndicator mini />
          </Flex>
        ) : releaseQuery.isError || !release ? (
          <Text variant="muted">{t('Unable to load release details')}</Text>
        ) : (
          <Grid
            columns={{
              zero: 'minmax(0, 1fr)',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: `repeat(${sectionCount}, minmax(0, 1fr))`,
            }}
            gap="xl"
          >
            <Stack gap="xs">
              <Text bold size="xs" uppercase variant="muted">
                {t('New Issues')}
              </Text>
              <Text size="xl" tabular>
                {newGroups}
              </Text>
            </Stack>

            <Stack gap="xs">
              <Text bold size="xs" uppercase variant="muted">
                {t('Date Created')}
              </Text>
              <Text>
                <DateTime date={release.dateCreated} />
              </Text>
            </Stack>

            <Stack gap="xs">
              <Text bold size="xs" uppercase variant="muted">
                {t('Package')}
              </Text>
              <Text ellipsis>{packageName ?? '—'}</Text>
            </Stack>

            {release.commitCount > 0 ? (
              <Stack gap="sm">
                <Text bold size="xs" uppercase variant="muted">
                  {getCommitSummary(release.commitCount, release.authors.length)}
                </Text>
                <Flex>
                  <AvatarList avatarSize={24} typeAvatars="authors" users={authors} />
                </Flex>
              </Stack>
            ) : null}

            {release.lastCommit ? (
              <Stack
                column={{zero: 'auto', sm: 'span 2', lg: 'auto'}}
                gap="xs"
                minWidth="0"
              >
                <Text bold size="xs" uppercase variant="muted">
                  {t('Last Commit')}
                </Text>
                <Text ellipsis>
                  <CommitLink
                    commitId={release.lastCommit.id}
                    commitTitle={lastCommitTitle}
                    inline
                    repository={release.lastCommit.repository}
                    showIcon={false}
                  />
                </Text>
                <Flex align="center" gap="xs" minWidth="0">
                  {release.lastCommit.author ? (
                    <UserAvatar size={16} user={release.lastCommit.author} />
                  ) : null}
                  <Text bold ellipsis size="sm">
                    {release.lastCommit.author?.name ?? t('Unknown author')}
                  </Text>
                  <Text size="sm" variant="muted">
                    <TimeSince date={release.lastCommit.dateCreated} />
                  </Text>
                </Flex>
              </Stack>
            ) : null}

            <Stack
              column={{zero: 'auto', sm: 'span 2', lg: 'auto'}}
              gap="xs"
              minWidth="0"
            >
              <Text bold size="xs" uppercase variant="muted">
                {t('Deploys')}
              </Text>
              {deploysQuery.isPending ? (
                <Flex justify="start">
                  <LoadingIndicator mini />
                </Flex>
              ) : deploysQuery.isError ? (
                <Text size="sm" variant="muted">
                  {t('Unable to load deploys')}
                </Text>
              ) : recentDeploys.length > 0 ? (
                <Flex align="center" gap="md" wrap="wrap">
                  {recentDeploys.map(deploy => (
                    <Flex key={deploy.id} align="center" gap="xs">
                      <Tag variant="info">{deploy.environment}</Tag>
                      <Text size="sm" variant="muted">
                        <TimeSince date={deploy.dateFinished} />
                      </Text>
                    </Flex>
                  ))}
                </Flex>
              ) : (
                <Text size="sm" variant="muted">
                  {t('No deploys')}
                </Text>
              )}
            </Stack>
          </Grid>
        )}
      </Stack>
    </Container>
  );
}
