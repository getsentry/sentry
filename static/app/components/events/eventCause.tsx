import {Fragment, JSXElementConstructor, useState} from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import {CommitRowProps} from 'sentry/components/commitRow';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import {Panel} from 'sentry/components/panels';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarProject, Commit, Group} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {getAnalyticsDataForGroup} from 'sentry/utils/events';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  commitRow: JSXElementConstructor<CommitRowProps>;
  eventId: string;
  project: AvatarProject;
  group?: Group;
}

export function EventCause({group, eventId, project, commitRow: CommitRow}: Props) {
  const organization = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const {data, isLoading} = useCommitters({
    eventId,
    projectSlug: project.slug,
  });
  const committers = data?.committers ?? [];

  useRouteAnalyticsParams({
    fetching: isLoading,
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
      ...getAnalyticsDataForGroup(group),
    });
  };

  const handleCommitClick = (commit: Commit) => {
    trackAdvancedAnalyticsEvent('issue_details.suspect_commits.commit_clicked', {
      organization,
      project_id: parseInt(project.id as string, 10),
      has_pull_request: commit.pullRequest?.id !== undefined,
      ...getAnalyticsDataForGroup(group),
    });
  };

  const commits = getUniqueCommitsWithAuthors();

  const commitHeading = tn('Suspect Commit', 'Suspect Commits (%s)', commits.length);

  return (
    <DataSection>
      <CauseHeader>
        <h3 data-test-id="event-cause">{commitHeading}</h3>
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
      </CauseHeader>
      <StyledPanel>
        {commits.slice(0, isExpanded ? 100 : 1).map(commit => (
          <CommitRow
            key={commit.id}
            commit={commit}
            onCommitClick={handleCommitClick}
            onPullRequestClick={handlePullRequestClick}
          />
        ))}
      </StyledPanel>
    </DataSection>
  );
}

const StyledPanel = styled(Panel)`
  margin: 0;
`;

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;
