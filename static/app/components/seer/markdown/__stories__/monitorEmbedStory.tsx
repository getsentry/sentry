import {useQuery} from '@tanstack/react-query';

import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import {getDetectorTypeLabel} from 'sentry/views/detectors/utils/detectorTypeConfig';

import {EmbedStory, EmbedVariant} from './embedStory';

const STORY_MONITOR_TYPES = [
  'error',
  'metric_issue',
  'monitor_check_in_failure',
  'uptime_domain_failure',
  'preprod_size_analysis',
] as const satisfies Array<Detector['type']>;

export function MonitorEmbedStory() {
  const organization = useOrganization();
  const {
    data: detectors,
    isError,
    isPending,
  } = useQuery(detectorListApiOptions(organization, {sortBy: '-id', limit: 100}));

  const storyDetectors = STORY_MONITOR_TYPES.flatMap(type => {
    const detector = detectors?.find(candidate => candidate.type === type);
    return detector ? [detector] : [];
  });

  return (
    <EmbedStory name="monitor">
      {isPending ? (
        <LoadingIndicator />
      ) : isError ? (
        <Text variant="muted">Unable to load a monitor example.</Text>
      ) : storyDetectors.length ? (
        storyDetectors.map(detector => (
          <EmbedVariant
            key={detector.type}
            name="monitor"
            label={`${getDetectorTypeLabel(detector.type)} monitor`}
            data={{
              id: detector.id,
              name: detector.name,
            }}
          />
        ))
      ) : (
        <Text variant="muted">No monitor is available for this organization.</Text>
      )}
    </EmbedStory>
  );
}
