import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {replayListApiOptions} from 'sentry/utils/replays/replayListApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {EmbedStory, EmbedVariant} from './embedStory';

export function ReplayEmbedStory() {
  const organization = useOrganization();
  const {data, isError, isPending} = useQuery(
    replayListApiOptions({
      options: {query: {sort: '-started_at'}},
      organization,
      queryReferrer: 'replayList',
    })
  );

  const replay = data?.data?.[0];

  return (
    <EmbedStory name="replay">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a replay example.</Text>
      ) : replay?.started_at ? (
        <EmbedVariant
          name="replay"
          label="Replay"
          data={{
            id: replay.id,
            eventTimestamp: String(replay.started_at),
          }}
        />
      ) : (
        <Text variant="muted">No replay is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
