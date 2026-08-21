import {lazy, useMemo} from 'react';
import queryString from 'query-string';
import {useQuery} from '@tanstack/react-query';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ReplayAccess} from 'sentry/components/replays/replayAccess';
import {ReplayTable} from 'sentry/components/replays/table/replayTable';
import {
  ReplayCountErrorsColumn,
  ReplayCountRageClicksColumn,
  ReplayDurationColumn,
  ReplaySessionColumn,
} from 'sentry/components/replays/table/replayTableColumns';
import {ResourceLink} from 'sentry/components/seer/markdown/embeds/components/resourceLink';
import {
  defineSeerEmbed,
  type EmbedOutput,
} from 'sentry/components/seer/markdown/embeds/utils';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {replayRecordApiOptions} from 'sentry/utils/replays/hooks/useReplayData';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';

import {EvidenceBoundary, EvidenceFrame, LazyEvidence} from './evidenceFrame';

const CLIP_OFFSETS = {
  durationAfterMs: 5_000,
  durationBeforeMs: 5_000,
};

const ReplayClipPreview = lazy(
  () => import('sentry/components/events/eventReplay/replayClipPreview')
);

type ReplayLinkOutput = Extract<EmbedOutput<'replay'>, {id: string}>;

function ReplayLink({id, eventTimestamp}: ReplayLinkOutput) {
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

function ReplayBlockPreview({id, eventTimestamp}: ReplayLinkOutput) {
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

function ReplayEvidenceContent({replayId}: {replayId: string}) {
  const organization = useOrganization();
  const query = useQuery({
    ...replayRecordApiOptions({
      organizationIdOrSlug: organization.slug,
      replayId,
    }),
    retry: false,
  });
  const replay = useMemo(
    () => (query.data?.data ? mapResponseToReplayRecord(query.data.data) : undefined),
    [query.data?.data]
  );
  const href = makeReplaysPathname({path: `/${replayId}/`, organization});

  return (
    <EvidenceFrame
      title={t('Replay %s', replayId)}
      icon={IconPlay}
      href={href}
      isLoading={query.isPending}
      error={query.error}
      onRetry={() => query.refetch()}
    >
      {replay ? (
        <ReplayTable
          columns={[
            ReplaySessionColumn,
            ReplayDurationColumn,
            ReplayCountErrorsColumn,
            ReplayCountRageClicksColumn,
          ]}
          error={null}
          isPending={false}
          replays={[replay]}
          showDropdownFilters={false}
        />
      ) : null}
    </EvidenceFrame>
  );
}

function ReplayUnavailable() {
  return (
    <EvidenceFrame title={t('Replay evidence')} icon={IconPlay}>
      <Text variant="muted">{t('Replay is not available for this organization.')}</Text>
    </EvidenceFrame>
  );
}

export const Replay = defineSeerEmbed({
  name: 'replay',
  render(props, level) {
    if ('id' in props) {
      return level === 'block' ? (
        <ReplayBlockPreview {...props} />
      ) : (
        <ReplayLink {...props} />
      );
    }
    return (
      <EvidenceBoundary>
        <ReplayAccess fallback={<ReplayUnavailable />}>
          <LazyEvidence>
            <ReplayEvidenceContent replayId={props.replay_id} />
          </LazyEvidence>
        </ReplayAccess>
      </EvidenceBoundary>
    );
  },
});
