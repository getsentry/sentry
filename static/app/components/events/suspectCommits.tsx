import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import type {CommitRowProps} from 'sentry/components/commitRow';
import {DataSection, SuspectCommitHeader} from 'sentry/components/events/styles';
import Panel from 'sentry/components/panels/panel';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarProject, Commit, Group} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  commitRow: React.ComponentType<CommitRowProps>;
  eventId: string;
  project: AvatarProject;
  group?: Group;
}

export function SuspectCommits({group, eventId, project, commitRow: CommitRow}: Props) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const {data} = useCommitters({
    eventId,
    projectSlug: project.slug,
  });
  const committers = data?.committers ?? [];

  function getUniqueCommitsWithAuthors() {
    // Get a list of commits with author information attached
    const commitsWithAuthors = flatMap(committers, ({commits, author}) =>
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
      project_id: parseInt(project.id as string, 10),
      suspect_commit_calculation: commit.suspectCommitType ?? 'unknown',
      suspect_commit_index: commitIndex,
      ...getAnalyticsDataForGroup(group),
    });
  };

  const handleCommitClick = (commit: Commit, commitIndex: number) => {
    trackAnalytics('issue_details.suspect_commits.commit_clicked', {
      organization,
      project_id: parseInt(project.id as string, 10),
      has_pull_request: commit.pullRequest?.id !== undefined,
      suspect_commit_calculation: commit.suspectCommitType ?? 'unknown',
      suspect_commit_index: commitIndex,
      ...getAnalyticsDataForGroup(group),
    });
  };

  const commitHeading = tn('Suspect Commit', 'Suspect Commits (%s)', commits.length);

  return (
    <DataSection>
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
    </DataSection>
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
