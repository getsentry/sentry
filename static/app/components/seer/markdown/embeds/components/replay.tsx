import {lazy} from 'react';
import queryString from 'query-string';

import {Container} from '@sentry/scraps/layout';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

const CLIP_OFFSETS = {
  durationAfterMs: 5_000,
  durationBeforeMs: 5_000,
};

const ReplayClipPreview = lazy(
  () => import('sentry/components/events/eventReplay/replayClipPreview')
);

function ReplayLink({id, eventTimestamp}: EmbedOutput<'replay'>) {
  const organization = useOrganization();
  const pathname = makeReplaysPathname({path: `/${id}/`, organization});
  const href = eventTimestamp
    ? queryString.stringifyUrl({url: pathname, query: {event_t: eventTimestamp}})
    : pathname;

  return (
    <ResourceLink
      icon={IconPlay}
      href={href}
      title={t('Replay %s', getShortEventId(id))}
    />
  );
}

function ReplayBlockPreview({id, eventTimestamp}: EmbedOutput<'replay'>) {
  const organization = useOrganization();

  if (!eventTimestamp) {
    return <ReplayLink id={id} eventTimestamp={eventTimestamp} />;
  }

  const eventTimestampMs = Math.floor(new Date(eventTimestamp).getTime());

  return (
    <ReplayAccess fallback={<ReplayLink id={id} eventTimestamp={eventTimestamp} />}>
      <Container
        background="primary"
        border="primary"
        radius="md"
        padding="md"
        overflow="hidden"
      >
        <LazyLoad
          analyticsContext="seer_embed"
          replaySlug={id}
          orgSlug={organization.slug}
          eventTimestampMs={eventTimestampMs}
          clipOffsets={CLIP_OFFSETS}
          fullReplayButtonProps={{
            analyticsEventKey: 'seer_embed.open_replay_details_clicked',
            analyticsEventName: 'Seer Embed: Open Replay Details Clicked',
          }}
          loadingFallback={
            <NegativeSpaceContainer
              style={{height: REPLAY_LOADING_HEIGHT}}
              data-test-id="replay-loading-placeholder"
            >
              <LoadingIndicator />
            </NegativeSpaceContainer>
          }
          LazyComponent={ReplayClipPreview}
        />
      </Container>
    </ReplayAccess>
  );
}

export const Replay = defineSeerEmbed({
  name: 'replay',
  render(props, level) {
    if (level === 'block') {
      return <ReplayBlockPreview {...props} />;
    }
    return <ReplayLink {...props} />;
  },
});
