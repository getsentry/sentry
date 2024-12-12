import {VitalPill} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

type Props = {
  tree: TraceTree;
};

const ALLOWED_VITALS = ['lcp', 'fcp', 'cls', 'ttfb', 'inp'];

export function TraceContextVitals({tree}: Props) {
  const hasWebVitals = tree.vital_types.has('web');
  const hasValidWebVitals = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => ALLOWED_VITALS.includes(vital.key))
  );

  if (!hasWebVitals || !hasValidWebVitals) {
    return null;
  }

  return ALLOWED_VITALS.map(webVital => {
    let vital: TraceTree.CollectedVital | undefined;
    tree.vitals.forEach(entry => (vital = entry.find(v => v.key === webVital)));

    return (
      <VitalPill
        key={vital?.key}
        webVital={webVital as WebVitals}
        score={vital?.score}
        meterValue={vital?.measurement.value}
      />
    );
  });
}
