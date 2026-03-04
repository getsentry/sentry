import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import SeenInfo from 'sentry/components/group/seenInfo';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';
import {issueFirstLastReleaseQueryOptions} from 'sentry/views/issueDetails/issueFirstLastReleaseQueryOptions';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export default function FirstLastSeenSection({group}: {group: Group}) {
  const organization = useOrganization();
  const {project} = group;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const environments = useEnvironmentsFromUrl();

  const {data: allEnvsGroupData} = useFetchAllEnvsGroupData(organization, group);
  const {data: groupReleaseData} = useQuery(
    issueFirstLastReleaseQueryOptions({
      groupId: group.id,
      organizationSlug: organization.slug,
      query: environments.length > 0 ? {environment: environments} : undefined,
    })
  );
  const {data: openPeriods} = useOpenPeriods(
    {groupId: group.id},
    {enabled: issueTypeConfig.useOpenPeriodChecks}
  );

  const lastSeen = issueTypeConfig.useOpenPeriodChecks
    ? (openPeriods?.[0]?.lastChecked ?? group.lastSeen)
    : group.lastSeen;

  const lastSeenGlobal = issueTypeConfig.useOpenPeriodChecks
    ? lastSeen
    : (allEnvsGroupData?.lastSeen ?? lastSeen);

  const shortEnvironmentLabel =
    environments.length > 1
      ? t('selected environments')
      : environments.length === 1
        ? environments[0]
        : undefined;

  return (
    <Flex direction="column" gap="sm">
      <Stack>
        <Flex gap="xs" align="baseline">
          <Text bold>{t('Last seen')}</Text>
          <SeenInfo
            date={lastSeen}
            dateGlobal={lastSeenGlobal}
            organization={organization}
            projectId={project.id}
            projectSlug={project.slug}
            environment={shortEnvironmentLabel}
          />
        </Flex>
        {lastSeen && (
          <ReleaseText project={group.project} release={groupReleaseData?.lastRelease} />
        )}
      </Stack>
      <Stack>
        <Flex gap="xs" align="baseline">
          <Text bold>{t('First seen')}</Text>
          <SeenInfo
            date={group.firstSeen}
            dateGlobal={allEnvsGroupData?.firstSeen ?? group.firstSeen}
            organization={organization}
            projectId={project.id}
            projectSlug={project.slug}
            environment={shortEnvironmentLabel}
          />
        </Flex>
        {group.firstSeen && (
          <ReleaseText project={group.project} release={groupReleaseData?.firstRelease} />
        )}
      </Stack>
    </Flex>
  );
}

function ReleaseText({project, release}: {project: Project; release?: Release}) {
  const organization = useOrganization();

  if (!release) {
    return null;
  }

  return (
    <Text size="sm" variant="muted">
      {t('in release')}{' '}
      <VersionHoverCard
        organization={organization}
        projectSlug={project.slug}
        releaseVersion={release.version}
      >
        <ReleaseVersion version={release.version} projectId={project.id} />
      </VersionHoverCard>
    </Text>
  );
}

const ReleaseVersion = styled(Version)`
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
