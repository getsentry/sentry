import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';

import {EmbedStory, EmbedVariant} from './embedStory';

export function TraceEmbedStory() {
  const {data, isError, isPending} = useQuery(
    useTracesApiOptions({
      datetime: {period: '7d', start: null, end: null, utc: null},
      limit: 25,
      sort: '-timestamp',
    })
  );
  const trace = data?.data.find(candidate => candidate.numSpans > 0);

  return (
    <EmbedStory name="trace">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a trace example.</Text>
      ) : trace ? (
        <EmbedVariant
          name="trace"
          label="Trace"
          data={{traceId: trace.trace, timestamp: new Date(trace.end).toISOString()}}
        />
      ) : (
        <Text variant="muted">
          No trace with spans is available for this organization.
        </Text>
      )}
    </EmbedStory>
  );
}
