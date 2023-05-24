import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useProjects from 'sentry/utils/useProjects';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  replayId: undefined | string;
};

function useProjectFromSlug({
  organization,
  projectSlug,
}: {
  organization: Organization;
  projectSlug: string;
}) {
  const {fetching, projects} = useProjects({
    slugs: [projectSlug],
    orgId: organization.slug,
  });
  return fetching ? undefined : projects[0];
}

export default function EventReplay({replayId, organization, projectSlug, event}: Props) {
  const hasReplaysFeature = organization.features.includes('session-replay');
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  const project = useProjectFromSlug({organization, projectSlug});
  const isReplayRelated = projectCanLinkToReplay(project);

  if (!hasReplaysFeature || fetching || !isReplayRelated) {
    return null;
  }

  if (!hasOrgSentReplays) {
    return (
      <ErrorBoundary mini>
        <LazyLoad component={onboardingPanel} />
      </ErrorBoundary>
    );
  }

  if (!replayId) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={replayPreview}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={organization.slug}
        event={event}
      />
    </ErrorBoundary>
  );
}
