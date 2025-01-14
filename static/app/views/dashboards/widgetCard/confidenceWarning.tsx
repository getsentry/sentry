import type {Confidence} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useExtrapolationMeta} from 'sentry/views/explore/charts';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';

interface ConfidenceWarningProps {
  confidence: Confidence;
  query: string;
}

export default function ConfidenceWarning({query, confidence}: ConfidenceWarningProps) {
  const extrapolationMetaResults = useExtrapolationMeta({
    dataset: DiscoverDatasets.SPANS_EAP_RPC,
    query,
  });

  return (
    <ConfidenceFooter
      sampleCount={extrapolationMetaResults.data?.[0]?.['count_sample()']}
      confidence={confidence}
    />
  );
}
