import {useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {STORY_MONITOR_DETECTORS} from 'sentry/components/seer/markdown/embeds/components/monitor/fixtures';
import {monitorDetailsApiOptions} from 'sentry/components/seer/markdown/embeds/components/monitor/monitorBlock';
import {DEFAULT_QUERY_CLIENT_CONFIG} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

import {EmbedStory, EmbedVariant} from './embedStory';

/**
 * Seeds a query client with fixture detectors instead of fetching real ones,
 * so the story renders the same rich, deterministic data everywhere it's
 * viewed rather than whatever monitors happen to exist in the current org.
 */
export function MonitorEmbedStory() {
  const organization = useOrganization();
  const [queryClient] = useState(() => new QueryClient(DEFAULT_QUERY_CLIENT_CONFIG));
  // Lazy useState initializers run exactly once, before children mount --
  // seeding here (rather than in an effect) guarantees the cache is
  // populated before MonitorBlock's first query.
  useState(() => {
    for (const detector of STORY_MONITOR_DETECTORS) {
      queryClient.setQueryData(
        monitorDetailsApiOptions(organization.slug, detector.id).queryKey,
        {headers: {}, json: detector}
      );
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <EmbedStory name="monitor">
        {STORY_MONITOR_DETECTORS.map(detector => (
          <EmbedVariant
            key={detector.type}
            name="monitor"
            label={`${getDetectorTypeLabel(detector.type)} monitor`}
            data={{
              id: detector.id,
              name: detector.name,
            }}
          />
        ))}
      </EmbedStory>
    </QueryClientProvider>
  );
}
