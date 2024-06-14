import {lazy} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {ReplayClipSection} from 'sentry/components/events/eventReplay/replayClipSection';
import LazyLoad from 'sentry/components/lazyLoad';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import useEventCanShowReplayUpsell from 'sentry/utils/event/useEventCanShowReplayUpsell';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';

interface Props {
  event: Event;
  projectSlug: string;
  group?: Group;
}

const ReplayOnboardingPanel = lazy(() => import('./replayInlineOnboardingPanel'));

export default function EventReplay({event, group, projectSlug}: Props) {
  const replayId = getReplayIdFromEvent(event);
  const {canShowUpsell, upsellPlatform, upsellProjectId} = useEventCanShowReplayUpsell({
    event,
    group,
    projectSlug,
  });

  if (replayId) {
    return <ReplayClipSection event={event} replayId={replayId} group={group} />;
  }

  if (canShowUpsell) {
    return (
      <ErrorBoundary mini>
        <LazyLoad
          LazyComponent={ReplayOnboardingPanel}
          platform={upsellPlatform}
          projectId={upsellProjectId}
        />
      </ErrorBoundary>
    );
  }

  return null;
}
