import {lazy} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';

const LazyMetricDetectorChart = lazy(async () => {
  const {MetricDetectorDetailsChart} =
    await import('sentry/views/detectors/components/details/metric/chart');
  return {default: MetricDetectorDetailsChart};
});

const LazyMetricDetectorDetails = lazy(async () => {
  const {MetricDetectorDetailsDetect} =
    await import('sentry/views/detectors/components/details/metric/detect');
  return {default: MetricDetectorDetailsDetect};
});

export function MetricMonitor({detector}: {detector: MetricDetector}) {
  return (
    <Stack gap="md">
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Metric data')}
        </Heading>
        <ErrorBoundary mini>
          <LazyLoad LazyComponent={LazyMetricDetectorChart} detector={detector} />
        </ErrorBoundary>
      </Stack>
      <Stack.Separator />
      <Stack gap="sm">
        <Heading as="h4" size="xs">
          {t('Rules')}
        </Heading>
        <LazyLoad LazyComponent={LazyMetricDetectorDetails} detector={detector} />
      </Stack>
    </Stack>
  );
}
