import {useCallback} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import type {Organization} from 'sentry/types';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

interface Props {
  eventTimestampMs: number;
  organization: Organization;
  replayId: string;
}

export default function ReplaySection({eventTimestampMs, organization, replayId}: Props) {
  const replayPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayPreview'),
    []
  );

  return (
    <LazyLoad
      analyticsContext="feedback"
      component={replayPreview}
      eventTimestampMs={eventTimestampMs}
      focusTab={TabKey.BREADCRUMBS}
      orgSlug={organization.slug}
      replaySlug={replayId}
      fullReplayButtonProps={{
        analyticsEventKey: 'feedback_details.open_replay_details_clicked',
        analyticsEventName: 'Feedback Details: Open Replay Details Clicked',
        analyticsParams: {
          organization,
        },
      }}
    />
  );
}
