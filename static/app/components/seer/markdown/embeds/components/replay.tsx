import {lazy} from 'react';
import queryString from 'query-string';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import {
  ResourceLink,
  type ResourceLinkFormatProps,
} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
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

/** Shared by the inline link and the block's header link, so the two cannot drift. */
function useReplayHref({id, eventTimestamp}: EmbedOutput<'replay'>): string {
  const organization = useOrganization();
  const pathname = makeReplaysPathname({path: `/${id}/`, organization});

  return eventTimestamp
    ? queryString.stringifyUrl({url: pathname, query: {event_t: eventTimestamp}})
    : pathname;
}

function getReplayTitle(id: string): string {
  return t('Replay %s', getShortEventId(id));
}

function ReplayLink({format, ...props}: EmbedOutput<'replay'> & ResourceLinkFormatProps) {
  const href = useReplayHref(props);

  return (
    <ResourceLink
      format={format}
      icon={IconPlay}
      href={href}
      title={getReplayTitle(props.id)}
    />
  );
}

function ReplayBlockPreview({id, eventTimestamp}: EmbedOutput<'replay'>) {
  const organization = useOrganization();
  const href = useReplayHref({id, eventTimestamp});

  // Without a timestamp there is no clip to frame, and a reader without replay
  // access sees nothing in the panel either. Both fall back to the bare link:
  // a card with nothing but its own link inside has nothing to collapse.
  if (!eventTimestamp) {
    return <ReplayLink id={id} eventTimestamp={eventTimestamp} />;
  }

  const eventTimestampMs = Math.floor(new Date(eventTimestamp).getTime());

  return (
    <ReplayAccess fallback={<ReplayLink id={id} eventTimestamp={eventTimestamp} />}>
      {/* Left expanded, the card's default: the clip is the reason the block
          was emitted, and collapsing it would not save the load -- the panel
          keeps its contents mounted. */}
      <SeerEmbedBlock
        href={href}
        icon={IconPlay}
        linkLabel={t('View Replay')}
        testId="seer-replay-embed"
        title={getReplayTitle(id)}
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
      </SeerEmbedBlock>
    </ReplayAccess>
  );
}

export const Replay = defineSeerEmbed({
  name: 'replay',
  render(props, level) {
    switch (level) {
      case 'block':
        return <ReplayBlockPreview {...props} />;
      case 'markdown':
        return <ReplayLink {...props} format="markdown" />;
      case 'inline':
        return <ReplayLink {...props} />;
    }
  },
});
