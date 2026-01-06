import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import SeenInfo from 'sentry/components/group/seenInfo';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t, tct} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useOrganization from 'sentry/utils/useOrganization';
import {useOpenPeriods} from 'sentry/views/detectors/hooks/useOpenPeriods';
import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

export default function FirstLastSeenSection({group}: {group: Group}) {
  const organization = useOrganization();
  const {project} = group;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const environments = useEnvironmentsFromUrl();

  const {data: allEnvsGroupData} = useFetchAllEnvsGroupData(organization, group);
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
      <div>
        <Flex gap="xs">
          <Title>{t('Last seen')}</Title>
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
          <ReleaseText project={group.project} release={group.lastRelease ?? undefined} />
        )}
      </div>
      <div>
        <Flex gap="xs">
          <Title>{t('First seen')}</Title>
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
            release={group.firstRelease ?? undefined}
          />
        )}
      </div>
    </Flex>
  );
}

function ReleaseText({project, release}: {project: Project; release?: Release}) {
  const organization = useOrganization();

  if (!release) {
    return null;
  }

  return (
    <Subtitle>
      {tct('in release [release]', {
        release: (
          <VersionHoverCard
            organization={organization}
            projectSlug={project.slug}
            releaseVersion={release.version}
          >
            <ReleaseWrapper>
              <Version version={release.version} projectId={project.id} />
            </ReleaseWrapper>
          </VersionHoverCard>
        ),
      })}
    </Subtitle>
  );
}

const ReleaseWrapper = styled('span')`
  a {
    color: ${p => p.theme.subText};
    text-decoration: underline;
    text-decoration-style: dotted;
  }
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;
