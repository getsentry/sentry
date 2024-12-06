import {useTheme} from '@emotion/react';

import {VitalMeter} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

type Props = {
  tree: TraceTree;
};

const ALLOWED_VITALS = ['lcp', 'fcp', 'cls', 'ttfb', 'inp'];

export function TraceContextVitals({tree}: Props) {
  const theme = useTheme();

  const hasWebVitals = tree.vital_types.has('web');
  const hasValidWebVitals = Array.from(tree.vitals.values()).some(vitalGroup =>
    vitalGroup.some(vital => ALLOWED_VITALS.includes(vital.key))
  );

  if (!hasWebVitals || !hasValidWebVitals) {
    return null;
  }

  return ALLOWED_VITALS.map((webVital, index) => {
    let vital: TraceTree.CollectedVital | undefined;
    tree.vitals.forEach(entry => (vital = entry.find(v => v.key === webVital)));

    // Render empty state
    if (!vital || !vital.score) {
      return (
        <VitalMeter
          key={webVital}
          webVital={webVital as WebVitals}
          score={undefined}
          meterValue={undefined}
          color={theme.charts.getColorPalette(3)[index]}
          showTooltip
          isAggregateMode={false}
        />
      );
    }

    const colors = theme.charts.getColorPalette(3);
    const score = Math.round(vital.score * 100);

    return (
      <VitalMeter
        key={vital.key}
        webVital={vital.key as WebVitals}
        score={score}
        meterValue={vital.measurement.value}
        showTooltip
        color={colors[index]}
        isAggregateMode={false}
      />
    );
  });
}
