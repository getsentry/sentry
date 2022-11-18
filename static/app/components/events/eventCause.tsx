import {Fragment, JSXElementConstructor, useState} from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import {CommitRowProps} from 'sentry/components/commitRow';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import {Panel} from 'sentry/components/panels';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AvatarProject, Commit, Group, IssueCategory} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  commitRow: JSXElementConstructor<CommitRowProps>;
  eventId: string;
  project: AvatarProject;
  group?: Group;
}

function EventCause({group, eventId, project, commitRow: CommitRow}: Props) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const {committers, fetching} = useCommitters({
    eventId,
    projectSlug: project.slug,
  });

  useRouteAnalyticsParams({
    fetching,
    num_suspect_commits: committers.length,
  });

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

  if (!committers.length) {
    return null;
  }

  const handlePullRequestClick = () => {
    trackAdvancedAnalyticsEvent('issue_details.suspect_commits.pull_request_clicked', {
      organization,
      project_id: parseInt(project.id as string, 10),
      group_id: parseInt(group?.id as string, 10),
      issue_category: group?.issueCategory ?? IssueCategory.ERROR,
    });
  };

  const handleCommitClick = (commit: Commit) => {
    trackAdvancedAnalyticsEvent('issue_details.suspect_commits.commit_clicked', {
      organization,
      project_id: parseInt(project.id as string, 10),
      group_id: parseInt(group?.id as string, 10),
      issue_category: group?.issueCategory ?? IssueCategory.ERROR,
      has_pull_request: commit.pullRequest?.id !== undefined,
    });
  };

  const commits = getUniqueCommitsWithAuthors();
  return (
    <DataSection>
      <CauseHeader>
        <h3 data-test-id="event-cause">
          {t('Suspect Commits')} ({commits.length})
        </h3>
        {commits.length > 1 && (
          <ExpandButton onClick={() => setIsExpanded(!isExpanded)}>
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
      </CauseHeader>
      <Panel>
        {commits.slice(0, isExpanded ? 100 : 1).map(commit => (
          <CommitRow
            key={commit.id}
            commit={commit}
            onCommitClick={handleCommitClick}
            onPullRequestClick={handlePullRequestClick}
          />
        ))}
      </Panel>
    </DataSection>
  );
}

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

export default EventCause;
