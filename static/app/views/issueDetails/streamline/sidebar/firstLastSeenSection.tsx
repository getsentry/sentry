import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import SeenInfo from 'sentry/components/group/seenInfo';
import Version from 'sentry/components/version';
import VersionHoverCard from 'sentry/components/versionHoverCard';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {type Group, GroupStatus} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {Release} from 'sentry/types/release';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useFetchAllEnvsGroupData} from 'sentry/views/issueDetails/groupSidebar';

interface GroupRelease {
  firstRelease: Release;
  lastRelease: Release;
}

export default function FirstLastSeenSection({group}: {group: Group}) {
  const organization = useOrganization();
  const issueTypeConfig = getConfigForIssueType(group, group.project);
  const {project} = group;

  const {data: allEnvironments} = useFetchAllEnvsGroupData(organization, group);
  const {data: groupReleaseData} = useApiQuery<GroupRelease>(
    [`/organizations/${organization.slug}/issues/${group.id}/first-last-release/`],
    {
      staleTime: 30000,
      gcTime: 30000,
    }
  );

  return (
    <Flex column gap={space(0.75)}>
      <div>
        <Flex gap={space(0.5)}>
          <Title>
            {issueTypeConfig.lastSeen.prefix}
            {issueTypeConfig.lastSeen.showStatus && group.status === GroupStatus.RESOLVED
              ? t('resolved')
              : t('ongoing')}
          </Title>
          {issueTypeConfig.lastSeen.showDate &&
            (group.lastSeen ? (
              <SeenInfo
                date={group.lastSeen}
                dateGlobal={allEnvironments?.lastSeen ?? group.lastSeen}
                organization={organization}
                projectId={project.id}
                projectSlug={project.slug}
              />
            ) : (
              t('N/A')
            ))}
        </Flex>
        <ReleaseText project={group.project} release={groupReleaseData?.lastRelease} />
      </div>
      <div>
        <Flex gap={space(0.5)}>
          <Title>{issueTypeConfig.customCopy.firstSeen || t('First seen')}</Title>
          {group.firstSeen ? (
            <SeenInfo
              date={group.firstSeen}
              dateGlobal={allEnvironments?.firstSeen ?? group.firstSeen}
              organization={organization}
              projectId={project.id}
              projectSlug={project.slug}
            />
          ) : (
            t('N/A')
          )}
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
