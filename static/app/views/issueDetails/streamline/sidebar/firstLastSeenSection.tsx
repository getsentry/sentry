import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import SeenInfo from 'sentry/components/group/seenInfo';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

export default function FirstLastSeenSection({group}: {group: Group}) {
  const organization = useOrganization();
  const {project} = group;
  const issueTypeConfig = getConfigForIssueType(group, group.project);

  const {data: allEnvironments} = useFetchAllEnvsGroupData(organization, group);
  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );
  const environments = useEnvironmentsFromUrl();

  const lastSeen = issueTypeConfig.useOpenPeriodChecks
    ? group.openPeriods?.[0]?.lastChecked ?? group.lastSeen
    : group.lastSeen;

  const shortEnvironmentLabel =
    environments.length > 1
      ? t('selected environments')
      : environments.length === 1
        ? environments[0]
        : undefined;

  const dateGlobal = issueTypeConfig.useOpenPeriodChecks
    ? lastSeen
    : allEnvironments?.lastSeen ?? lastSeen;

  return (
    <Flex column gap={space(0.75)}>
      <div>
        <Flex gap={space(0.5)}>
          <Title>{t('Last seen')}</Title>
          <SeenInfo
            date={lastSeen}
            dateGlobal={dateGlobal}
            organization={organization}
            projectId={project.id}
            projectSlug={project.slug}
            environment={shortEnvironmentLabel}
          />
        </Flex>
        <ReleaseText project={group.project} release={groupReleaseData?.lastRelease} />
      </div>
      <div>
        <Flex gap={space(0.5)}>
          <Title>{t('First seen')}</Title>
          <SeenInfo
            date={group.firstSeen}
            dateGlobal={allEnvironments?.firstSeen ?? group.firstSeen}
            organization={organization}
            projectId={project.id}
            projectSlug={project.slug}
            environment={shortEnvironmentLabel}
          />
        </Flex>
        <ReleaseText project={group.project} release={groupReleaseData?.firstRelease} />
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
    color: ${p => p.theme.gray300};
    text-decoration: underline;
    text-decoration-style: dotted;
  }
`;

const Title = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
