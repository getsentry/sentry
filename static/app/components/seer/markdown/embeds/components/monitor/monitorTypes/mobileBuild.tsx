import {lazy} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {LazyLoad} from 'sentry/components/lazyLoad';
import {t} from 'sentry/locale';
import type {PreprodDetector} from 'sentry/types/workflowEngine/detectors';

const LazyMobileBuildDetectorDetails = lazy(async () => {
  const {MobileBuildDetectorDetailsDetect} =
    await import('sentry/views/detectors/components/details/mobileBuild/detect');
  return {default: MobileBuildDetectorDetailsDetect};
});

export function MobileBuildMonitor({detector}: {detector: PreprodDetector}) {
  return (
    <Stack gap="sm">
      <Heading as="h4" size="xs">
        {t('Rules')}
      </Heading>
      <LazyLoad LazyComponent={LazyMobileBuildDetectorDetails} detector={detector} />
    </Stack>
  );
}
