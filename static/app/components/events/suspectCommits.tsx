import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {CommitRow} from 'sentry/components/commitRow';
import {SuspectCommitFeedback} from 'sentry/components/events/suspectCommitFeedback';
import {Panel} from 'sentry/components/panels/panel';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Group} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useCommitters} from 'sentry/utils/useCommitters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';

interface Props {
  eventId: string;
  group: Group;
  projectSlug: Project['slug'];
}

export function SuspectCommits({group, eventId, projectSlug}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});
  const {data} = useCommitters({
    eventId,
    projectSlug,
    group,
  });
  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const committers = useMemo(
    () => (data?.committers ?? []).slice(0, 100),
    [data?.committers]
  );

  useRouteAnalyticsParams({
    num_suspect_commits: committers.length,
    suspect_commit_calculation:
      committers[0]?.commits[0]?.suspectCommitType ?? 'no suspect commit',
  });

  if (!committers.length) {
    return null;
  }

  const handlePullRequestClick = (commit: Commit, commitIndex: number) => {
    trackAnalytics('issue_details.suspect_commits.pull_request_clicked', {
      organization,
      project_id: parseInt(project?.id as string, 10),
      suspect_commit_calculation: commit.suspectCommitType ?? 'unknown',
      suspect_commit_index: commitIndex,
      ...getAnalyticsDataForGroup(group),
    });
  };

  const handleCommitClick = (commit: Commit, commitIndex: number) => {
    trackAnalytics('issue_details.suspect_commits.commit_clicked', {
      organization,
      project_id: parseInt(project?.id as string, 10),
      has_pull_request: commit.pullRequest?.id !== undefined,
      suspect_commit_calculation: commit.suspectCommitType ?? 'unknown',
      suspect_commit_index: commitIndex,
      ...getAnalyticsDataForGroup(group),
    });
  };

  return (
    <SuspectCommitWrapper>
      <ScrollCarousel
        gap="lg"
        transparentMask
        jumpItemCount={1}
        aria-label={t('Suspect commits')}
      >
        {committers.map((committer, index) => {
          const commit: Commit = {...committer.commits[0]!, author: committer.author};
          return (
            <GradientPanel key={index}>
              <Flex justify="between" align="end" padding="md md xs lg">
                <Heading as="h4" size="lg">
                  {t('Suspect Commit')}
                </Heading>
                {!isSelfHosted && committer.group_owner_id !== undefined && (
                  <SuspectCommitFeedback
                    groupOwnerId={committer.group_owner_id}
                    organization={organization}
                  />
                )}
              </Flex>
              <div>
                <CommitRow
                  commit={commit}
                  onCommitClick={() => handleCommitClick(commit, index)}
                  onPullRequestClick={() => handlePullRequestClick(commit, index)}
                  project={project}
                />
              </div>
            </GradientPanel>
          );
        })}
      </ScrollCarousel>
    </SuspectCommitWrapper>
  );
}

const GradientPanel = styled(Panel)`
  background: ${p => p.theme.tokens.background.primary}
    linear-gradient(to right, rgba(245, 243, 247, 0), ${p => p.theme.colors.surface200});
  overflow: hidden;
  margin-bottom: 0;
  width: 100%;
  min-width: 65%;
  &:last-child {
    margin-right: ${p => p.theme.space.xl};
  }
  &:first-child {
    margin-left: ${p => p.theme.space.xl};
  }
`;

const SuspectCommitWrapper = styled('div')`
  margin-right: -${p => p.theme.space.xl};
  margin-left: -${p => p.theme.space.xl};
`;
