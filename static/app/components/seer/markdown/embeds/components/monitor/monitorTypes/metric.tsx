import {lazy} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';

const LazyMetricDetectorDetails = lazy(async () => {
  const {MetricDetectorDetailsDetect} =
    await import('sentry/views/detectors/components/details/metric/detect');
  return {default: MetricDetectorDetailsDetect};
});

export function MetricMonitor({detector}: {detector: MetricDetector}) {
  return (
    <Stack gap="sm">
      <Heading as="h4" size="xs">
        {t('Rules')}
      </Heading>
      <LazyLoad LazyComponent={LazyMetricDetectorDetails} detector={detector} />
    </Stack>
  );
}
