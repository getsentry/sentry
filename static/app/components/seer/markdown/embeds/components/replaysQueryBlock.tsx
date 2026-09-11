import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {Duration} from 'sentry/components/duration/duration';
import {ReplayBadge} from 'sentry/components/replays/replayBadge';
import {QueryEmbedCard} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedCard';
import {QUERY_EMBED_ROW_LIMIT} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedConstants';
import {
  QueryEmbedTable,
  type QueryEmbedColumn,
} from 'sentry/components/seer/markdown/embeds/components/queryEmbed/queryEmbedTable';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatNumber} from 'sentry/utils/number/formatNumber';
import {mapResponseToReplayRecord} from 'sentry/utils/replays/replayDataUtils';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';

import {getReplaysQueryTitle} from './replaysQueryLink';
import {getReplaysQueryHref, type ReplaysQueryData} from './replaysQueryUtils';

/**
 * An archived replay keeps its id but loses everything measured about it, so
 * every column but the badge has nothing to show.
 */
function archivedFallback() {
  return (
    <Text ellipsis variant="muted">
      —
    </Text>
  );
}

const COLUMNS: Array<QueryEmbedColumn<ReplayListRecord>> = [
  {
    key: 'replay',
    label: t('Replay'),
    render: replay => <ReplayBadge replay={replay} />,
  },
  {
    key: 'duration',
    label: t('Duration'),
    render: replay =>
      replay.is_archived || !replay.duration ? (
        archivedFallback()
      ) : (
        <Duration duration={[replay.duration.asMilliseconds(), 'ms']} precision="sec" />
      ),
  },
  {
    key: 'count_errors',
    label: t('Errors'),
    render: replay =>
      replay.is_archived ? (
        archivedFallback()
      ) : (
        <Text ellipsis>{formatNumber(replay.count_errors ?? 0)}</Text>
      ),
  },
  {
    key: 'count_rage_clicks',
    label: t('Rage clicks'),
    render: replay =>
      replay.is_archived ? (
        archivedFallback()
      ) : (
        <Text ellipsis>{formatNumber(replay.count_rage_clicks ?? 0)}</Text>
      ),
  },
];

export default function ReplaysQueryBlock({data}: {data: ReplaysQueryData}) {
  const organization = useOrganization();

  const replaysQuery = useQuery({
    ...replayListApiOptions({
      organization,
      // `replayList` is the referrer for a plain search; the issue and
      // transaction referrers force an all-projects override we don't want.
      queryReferrer: 'replayList',
      options: {
        query: {
          query: data.query,
          sort: data.sort,
          project: data.projects?.map(String),
          environment: data.environments,
          statsPeriod: data.statsPeriod,
          start: data.start,
          end: data.end,
          per_page: QUERY_EMBED_ROW_LIMIT,
        },
      },
    }),
    retry: false,
  });

  // The list endpoint returns durations and timestamps raw; every row
  // component below expects them hydrated.
  const rows = (replaysQuery.data?.data ?? []).map(mapResponseToReplayRecord);

  return (
    <QueryEmbedCard
      href={getReplaysQueryHref(data, organization)}
      icon={IconPlay}
      linkLabel={t('View Replays')}
      query={data.query}
      testId="seer-replays-query-embed"
      title={getReplaysQueryTitle(data)}
    >
      <QueryEmbedTable
        columns={COLUMNS}
        emptyMessage={t('No matching replays')}
        errorMessage={t('Unable to load replays')}
        isError={replaysQuery.isError}
        isPending={replaysQuery.isPending}
        rowKey={replay => replay.id}
        rows={rows}
      />
    </QueryEmbedCard>
  );
}
