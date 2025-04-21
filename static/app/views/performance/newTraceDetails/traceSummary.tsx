import type React from 'react';

import {t} from 'sentry/locale';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {TraceContextSectionKeys} from 'sentry/views/performance/newTraceDetails/traceHeader/scrollToSectionLinks';

export function TraceSummarySection() {
  return (
    <InterimSection
      key="trace-summary"
      type={TraceContextSectionKeys.SUMMARY}
      title={t('Trace Summary')}
      data-test-id="trace-summary-section"
      initialCollapse={false}
    >
      <div>Trace Summary</div>
    </InterimSection>
  );
}
