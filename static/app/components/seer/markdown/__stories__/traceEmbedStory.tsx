import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useTracesApiOptions} from 'sentry/views/explore/hooks/useTraces';

import {EmbedStory, EmbedVariant} from './embedStory';

/**
 * `trace` and `traceWaterfall` take the same data and both need a real trace to
 * demo against, so they share one story component rather than one fetch each.
 */
interface TraceEmbedStoryProps {
  name?: 'trace' | 'traceWaterfall';
}

export function TraceEmbedStory({name = 'trace'}: TraceEmbedStoryProps) {
  const {data, isError, isPending} = useQuery(
    useTracesApiOptions({
      datetime: {period: '7d', start: null, end: null, utc: null},
      limit: 25,
      sort: '-timestamp',
    })
  );
  const trace = data?.data.find(candidate => candidate.numSpans > 0);

  return (
    <EmbedStory name={name}>
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a trace example.</Text>
      ) : trace ? (
        <EmbedVariant
          name={name}
          label={name === 'traceWaterfall' ? 'Trace waterfall' : 'Trace'}
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
