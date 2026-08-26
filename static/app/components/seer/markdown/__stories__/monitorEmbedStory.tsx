import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';

import {EmbedStory, EmbedVariant} from './embedStory';

export function MonitorEmbedStory() {
  const organization = useOrganization();
  const {
    data: detectors,
    isError,
    isPending,
  } = useQuery(detectorListApiOptions(organization, {sortBy: '-id', limit: 1}));

  const detector = detectors?.[0];

  return (
    <EmbedStory name="monitor">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a monitor example.</Text>
      ) : detector ? (
        <EmbedVariant
          name="monitor"
          label="Monitor"
          data={{
            id: detector.id,
            name: detector.name,
            statsPeriod: '24h',
          }}
        />
      ) : (
        <Text variant="muted">No monitor is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
