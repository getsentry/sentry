import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SeenInfo} from 'sentry/components/group/seenInfo';
import {Placeholder} from 'sentry/components/placeholder';
import {Version} from 'sentry/components/version';
import {VersionHoverCard} from 'sentry/components/versionHoverCard';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {issueFirstLastReleaseQueryOptions} from 'sentry/views/issueDetails/issueFirstLastReleaseQueryOptions';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

function useFetchAllEnvsGroupData(organization: OrganizationSummary, group: Group) {
  return useQuery({
    ...groupApiOptions({
      organizationSlug: organization.slug,
      groupId: group.id,
      environments: [],
    }),
    gcTime: 30_000,
  });
}

export function FirstLastSeenSection({event, group}: {group: Group; event?: Event}) {
  const organization = useOrganization();
  const {project} = group;
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const shouldReserveReleaseSpace = !!event?.release;

  const environments = useEnvironmentsFromUrl();

  const {data: allEnvsGroupData} = useFetchAllEnvsGroupData(organization, group);
  const {data: groupReleaseData, isPending: isReleaseDataPending} = useQuery(
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
    <Stack gap="sm">
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
          <ReleaseText
            project={group.project}
            release={groupReleaseData?.lastRelease}
            preserveSpace={isReleaseDataPending && shouldReserveReleaseSpace}
          />
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
          <ReleaseText
            project={group.project}
            release={groupReleaseData?.firstRelease}
            preserveSpace={isReleaseDataPending && shouldReserveReleaseSpace}
          />
        )}
      </Stack>
    </Stack>
  );
}

function ReleaseText({
  project,
  release,
  preserveSpace,
}: {
  project: Project;
  preserveSpace?: boolean;
  release?: Release | null;
}) {
  const organization = useOrganization();

  if (!release) {
    return preserveSpace ? <ReleaseTextPlaceholder /> : null;
  }

  return (
    <Grid
      columns="max-content minmax(0, 1fr)"
      align="center"
      gap="xs"
      minWidth={0}
      maxWidth="100%"
    >
      <Container as="span" whiteSpace="nowrap">
        <Text size="sm" variant="muted">
          {t('in release')}{' '}
        </Text>
      </Container>
      <ReleaseVersionWrapper>
        <VersionHoverCard
          organization={organization}
          projectSlug={project.slug}
          releaseVersion={release.version}
        >
          <ReleaseVersion version={release.version} projectId={project.id} truncate />
        </VersionHoverCard>
      </ReleaseVersionWrapper>
    </Grid>
  );
}

function ReleaseTextPlaceholder() {
  return (
    <Container aria-hidden="true" maxWidth="100%">
      <Placeholder height="20px" />
    </Container>
  );
}

const ReleaseVersionWrapper = styled('span')`
  display: flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
`;

const ReleaseVersion = styled(Version)`
  display: block;
  min-width: 0;
  max-width: 100%;
  width: 100%;
  color: ${p => p.theme.tokens.content.secondary};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
