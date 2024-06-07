import {lazy} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {ReplayClipSection} from 'sentry/components/events/eventReplay/replayClipSection';
import LazyLoad from 'sentry/components/lazyLoad';
import {replayBackendPlatforms} from 'sentry/data/platformCategories';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanUpsellReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface Props {
  event: Event;
  projectSlug: string;
  group?: Group;
}

const ReplayOnboardingPanel = lazy(() => import('./replayInlineOnboardingPanel'));

export default function EventReplay({event, group, projectSlug}: Props) {
  const organization = useOrganization();
  const hasReplaysFeature = organization.features.includes('session-replay');

  const {hasOrgSentReplays, fetching: fetchingHasSentReplays} =
    useHasOrganizationSentAnyReplayEvents();
  const project = useProjectFromSlug({organization, projectSlug});

  const replayId = getReplayIdFromEvent(event);

  if (!hasReplaysFeature || fetchingHasSentReplays) {
    return null;
  }

  const platform = group?.project.platform ?? group?.platform ?? 'other';
  const projectId = group?.project.id ?? event.projectID ?? '';

  if (replayId) {
    return <ReplayClipSection event={event} replayId={replayId} group={group} />;
  }

  if (
    projectCanUpsellReplay(project) &&
    (!hasOrgSentReplays || replayBackendPlatforms.includes(platform))
  ) {
    return (
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={ReplayOnboardingPanel}
          platform={platform}
          projectId={projectId}
        />
      </ErrorBoundary>
    );
  }

  return null;
}
