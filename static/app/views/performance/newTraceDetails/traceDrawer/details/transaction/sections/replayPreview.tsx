import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import ReplayClipPreview from 'sentry/components/events/eventReplay/replayClipPreview';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

const REPLAY_CLIP_OFFSETS = {
  durationAfterMs: 5_000,
  durationBeforeMs: 5_000,
};

export function getEventTimestampMs(event: EventTransaction): number {
  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  return timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;
}

function ReplaySection({
  replayId,
  eventTimestampMs,
  organization,
  analyticsParams,
  showTitle = false,
}: {
  eventTimestampMs: number;
  organization: Organization;
  replayId: string;
  analyticsParams?: Record<string, unknown>;
  showTitle?: boolean;
}) {
  return (
    <Stack>
      {showTitle ? <ReplaySectionTitle>{t('Session Replay')}</ReplaySectionTitle> : null}
      <ReplayClipPreview
        analyticsContext="trace-view"
        replaySlug={replayId}
        orgSlug={organization.slug}
        eventTimestampMs={eventTimestampMs}
        clipOffsets={REPLAY_CLIP_OFFSETS}
        fullReplayButtonProps={{
          analyticsEventKey: 'trace-view.drawer-open-replay-details-clicked',
          analyticsEventName: 'Trace View: Open Replay Details Clicked',
          ...(analyticsParams
            ? {analyticsParams: {...analyticsParams, organization}}
            : {}),
        }}
      />
    </Stack>
  );
}

export function ReplayPreview({
  replayId,
  eventTimestampMs,
  organization,
  analyticsParams,
}: {
  eventTimestampMs: number;
  organization: Organization;
  replayId: string | undefined;
  analyticsParams?: Record<string, unknown>;
}) {
  if (!replayId) {
    return null;
  }

  return (
    <ReplayAccess>
      <FoldSection
        title={t('Session Replay')}
        sectionKey="trace_session_replay"
        disableCollapsePersistence
      >
        <ReplaySection
          replayId={replayId}
          eventTimestampMs={eventTimestampMs}
          organization={organization}
          analyticsParams={analyticsParams}
        />
      </FoldSection>
    </ReplayAccess>
  );
}

const ReplaySectionTitle = styled('div')`
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.xl};
`;
