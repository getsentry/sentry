import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {METRICS_EXEMPLARS_DOCS_URL} from 'sentry/views/explore/metrics/constants';
import {MetricsSamplesTable} from 'sentry/views/explore/metrics/metricInfoTabs/metricsSamplesTable';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';

interface SamplesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

const HISTOGRAM_EXEMPLARS_QUERY = `${TraceMetricKnownFieldKey.ROW_KIND}:exemplar`;

/**
 * Histograms arrive as pre-aggregated buckets, so the only rows that represent
 * a real measurement with trace context are exemplars. The samples tab shows
 * just those and explains itself when the SDK did not send any.
 */
export function SamplesTab({traceMetric, isMetricOptionsEmpty}: SamplesTabProps) {
  if (traceMetric.type !== 'histogram') {
    return (
      <MetricsSamplesTable
        traceMetric={traceMetric}
        isMetricOptionsEmpty={isMetricOptionsEmpty}
      />
    );
  }

  return (
    <MetricsSamplesTable
      traceMetric={traceMetric}
      isMetricOptionsEmpty={isMetricOptionsEmpty}
      requiredQuery={HISTOGRAM_EXEMPLARS_QUERY}
      emptyMessage={tct(
        'This histogram has no exemplars. Samples for histograms come from exemplars attached by the SDK. [link:Learn more]',
        {link: <ExternalLink href={METRICS_EXEMPLARS_DOCS_URL} />}
      )}
    />
  );
}
