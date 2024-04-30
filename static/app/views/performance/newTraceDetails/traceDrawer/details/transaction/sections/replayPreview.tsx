import styled from '@emotion/styled';

import {REPLAY_CLIP_OFFSETS} from 'sentry/components/events/eventReplay';
import ReplayClipPreview from 'sentry/components/events/eventReplay/replayClipPreview';
import {LazyRender} from 'sentry/components/lazyRender';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';

import {TraceDrawerComponents} from '../../styles';

function ReplaySection({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const replayId = getReplayIdFromEvent(event);
  const startTimestampMS =
    event && 'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;

  return replayId ? (
    <ReplaySectionContainer>
      <ReplaySectionTitle>{t('Session Replay')}</ReplaySectionTitle>
      <ReplayClipPreview
        analyticsContext="trace-view"
        replaySlug={replayId}
        orgSlug={organization.slug}
        eventTimestampMs={eventTimestampMs}
        clipOffsets={REPLAY_CLIP_OFFSETS}
        fullReplayButtonProps={{
          analyticsEventKey: 'trace-view.drawer-open-replay-details-clicked',
          analyticsEventName: 'Trace View: Open Replay Details Clicked',
          analyticsParams: {
            ...getAnalyticsDataForEvent(event),
            organization,
          },
        }}
      />
    </ReplaySectionContainer>
  ) : null;
}

function ReplayPreview({
  event,
  organization,
}: {
  event: EventTransaction;
  organization: Organization;
}) {
  const replayId = getReplayIdFromEvent(event);

  if (!replayId) {
    return null;
  }

  return (
    <LazyRender {...TraceDrawerComponents.LAZY_RENDER_PROPS} containerHeight={480}>
      <ReplaySection event={event} organization={organization} />
    </LazyRender>
  );
}

const ReplaySectionContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ReplaySectionTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 600;
  margin-bottom: ${space(2)};
`;

export default ReplayPreview;
