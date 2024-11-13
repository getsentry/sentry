import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import type {CommitRowProps} from 'sentry/components/commitRow';
import {SuspectCommitHeader} from 'sentry/components/events/styles';
import Panel from 'sentry/components/panels/panel';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import type {Commit} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface Props {
  commitRow: React.ComponentType<CommitRowProps>;
  eventId: string;
  projectSlug: Project['slug'];
  group?: Group;
}

export function SuspectCommits({
  group,
  eventId,
  projectSlug,
  commitRow: CommitRow,
}: Props) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const project = useProjectFromSlug({organization, projectSlug});
  const {data} = useCommitters({
    eventId,
    projectSlug,
    group,
  });
  const committers = data?.committers ?? [];

  const hasStreamlinedUI = useHasStreamlinedUI();

  function getUniqueCommitsWithAuthors() {
    // Get a list of commits with author information attached
    const commitsWithAuthors = committers.flatMap(({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    // Remove duplicate commits
    return uniqBy(commitsWithAuthors, commit => commit.id);
  }

  const commits = getUniqueCommitsWithAuthors();

  useRouteAnalyticsParams({
    num_suspect_commits: commits.length,
    suspect_commit_calculation: commits[0]?.suspectCommitType ?? 'no suspect commit',
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

  const commitHeading = tn('Suspect Commit', 'Suspect Commits (%s)', commits.length);

  return hasStreamlinedUI ? (
    <SuspectCommitWrapper>
      <ScrollCarousel
        gap={1.5}
        transparentMask
        jumpItemCount={1}
        aria-label={t('Suspect commits')}
      >
        {commits.slice(0, 100).map((commit, commitIndex) => (
          <StreamlinedPanel key={commitIndex}>
            <Title>{t('Suspect Commit')}</Title>
            <div>
              <CommitRow
                key={commit.id}
                commit={commit}
                onCommitClick={() => handleCommitClick(commit, commitIndex)}
                onPullRequestClick={() => handlePullRequestClick(commit, commitIndex)}
                project={project}
              />
            </div>
          </StreamlinedPanel>
        ))}
      </ScrollCarousel>
    </SuspectCommitWrapper>
  ) : (
    <div>
      <SuspectCommitHeader>
        <h3 data-test-id="suspect-commit">{commitHeading}</h3>
        {commits.length > 1 && (
          <ExpandButton
            onClick={() => setIsExpanded(!isExpanded)}
            data-test-id="expand-commit-list"
          >
            {isExpanded ? (
              <Fragment>
                {t('Show less')} <IconSubtract isCircled size="md" />
              </Fragment>
            ) : (
              <Fragment>
                {t('Show more')} <IconAdd isCircled size="md" />
              </Fragment>
            )}
          </ExpandButton>
        )}
      </SuspectCommitHeader>
      <StyledPanel>
        {commits.slice(0, isExpanded ? 100 : 1).map((commit, commitIndex) => (
          <CommitRow
            key={commit.id}
            commit={commit}
            onCommitClick={() => handleCommitClick(commit, commitIndex)}
            onPullRequestClick={() => handlePullRequestClick(commit, commitIndex)}
          />
        ))}
      </StyledPanel>
    </div>
  );
}

export const StyledPanel = styled(Panel)`
  margin: 0;
`;

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
  padding: 12px 12px 0 12px;
`;

const StreamlinedPanel = styled(Panel)`
  background: ${p => p.theme.background}
    linear-gradient(to right, rgba(245, 243, 247, 0), ${p => p.theme.surface100});
  overflow: hidden;
  margin-bottom: 0;
  width: 100%;
  min-width: 85%;
`;

const SuspectCommitWrapper = styled('div')`
  margin-right: 0;
  margin-left: 0;
`;
