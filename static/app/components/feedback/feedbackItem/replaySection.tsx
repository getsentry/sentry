import {lazy} from 'react';

import LazyLoad from 'sentry/components/lazyLoad';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import type {Organization} from 'sentry/types/organization';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';

interface Props {
  eventTimestampMs: number;
  organization: Organization;
  replayId: string;
}

const CLIP_OFFSETS = {
  durationAfterMs: 0,
  durationBeforeMs: 20_000,
};

const LazyReplayClipPreviewComponent = lazy(
  () => import('sentry/components/events/eventReplay/replayClipPreview')
);

export default function ReplaySection({eventTimestampMs, organization, replayId}: Props) {
  const props = {
    analyticsContext: 'feedback',
    eventTimestampMs,
    focusTab: TabKey.BREADCRUMBS,
    orgSlug: organization.slug,
    replaySlug: replayId,
    fullReplayButtonProps: {
      analyticsEventKey: 'feedback_details.open_replay_details_clicked',
      analyticsEventName: 'Feedback Details: Open Replay Details Clicked',
      analyticsParams: {
        organization,
      },
    },
  };

  return (
    <ReplayAccess>
      <LazyLoad
        key={replayId}
        {...props}
        LazyComponent={LazyReplayClipPreviewComponent}
        clipOffsets={CLIP_OFFSETS}
      />
    </ReplayAccess>
  );
}
