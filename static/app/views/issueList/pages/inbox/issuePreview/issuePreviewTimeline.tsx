import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {getOrderedAutofixSections} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PullRequestList} from 'sentry/components/group/externalIssuesList/linkedPullRequests';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {GroupActivityType} from 'sentry/types/group';
import type {LinkedPullRequest} from 'sentry/types/integrations';
import {ActivitySection} from 'sentry/views/issueDetails/activitySection';
import type {DisplayedActivityFeedItem} from 'sentry/views/issueDetails/activitySection/activityLineItem/activityFeedItem';

import {getAutofixTimelineItems} from './autofixTimeline';
import {IssuePreviewAutofixSection} from './issuePreviewAutofixSection';
import {IssuePreviewAutofixSummary} from './issuePreviewAutofixSummary';
import {useIssuePreviewSeer} from './issuePreviewSeer';

export function IssuePreviewTimeline({
  group,
  pullRequests,
}: {
  group: Group;
  pullRequests: LinkedPullRequest[];
}) {
  const previewSeer = useIssuePreviewSeer();
  const {autofix, state} = previewSeer;
  const {runState} = autofix;
  const showAnalysis = state === 'summary' || state === 'configure';
  const sections = showAnalysis ? getOrderedAutofixSections(runState) : [];
  const timelineItems = getAutofixTimelineItems(
    group.activity,
    runState?.run_id,
    sections
  );
  const pullRequestMatches = pullRequests.map(pullRequest => ({
    pullRequest,
    activity: group.activity.find(
      activity =>
        activity.type === GroupActivityType.SET_RESOLVED_IN_PULL_REQUEST &&
        activity.data.pullRequest?.externalUrl === pullRequest.externalUrl
    ),
  }));
  const unmatchedPullRequests = pullRequestMatches
    .filter(match => !match.activity)
    .map(match => match.pullRequest);
  const timelineSteps = timelineItems.reduce((steps, {section}) => {
    if (section) {
      steps.add(section.step);
    }
    return steps;
  }, new Set<string>());
  const items = timelineItems.map((item): DisplayedActivityFeedItem => {
    const {section} = item;
    const pullRequest = pullRequestMatches.find(
      match => match.activity?.id === item.activity.id
    )?.pullRequest;
    if (item.type === 'collapsed_status_activities' || (!section && !pullRequest)) {
      return item;
    }
    return {
      ...item,
      variant: section ? 'card' : undefined,
      body: (
        <Stack paddingTop={section ? '0' : 'md'} gap="xl">
          {section && (
            <ErrorBoundary mini>
              <IssuePreviewAutofixSection
                autofix={autofix}
                groupId={group.id}
                section={section}
                readOnly={state === 'configure'}
              />
            </ErrorBoundary>
          )}
          {pullRequest && (
            <PullRequestList
              ariaLabel={t('Linked pull requests')}
              group={group}
              pullRequests={[pullRequest]}
              variant="default"
            />
          )}
        </Stack>
      ),
    };
  });

  return (
    <Stack gap="2xl">
      {showAnalysis && (
        <IssuePreviewAutofixSummary
          autofix={autofix}
          groupId={group.id}
          excludeSteps={timelineSteps}
          readOnly={state === 'configure'}
        />
      )}
      <Stack as="section" aria-label={t('Issue Timeline')} gap="xl">
        <Heading as="h3" size="md">
          {t('Issue Timeline')}
        </Heading>
        {unmatchedPullRequests.length > 0 && (
          <PullRequestList
            ariaLabel={t('Other linked pull requests')}
            group={group}
            pullRequests={unmatchedPullRequests}
            variant="default"
          />
        )}
        <ErrorBoundary mini>
          <ActivitySection
            group={group}
            minHeight={40}
            variant="standalone"
            placeholder={t('Add a comment. Tag users with @, or teams with #')}
            items={items}
          />
        </ErrorBoundary>
      </Stack>
    </Stack>
  );
}
