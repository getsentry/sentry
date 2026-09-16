import {Alert} from '@sentry/scraps/alert';

import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {CronDetectorDetails} from 'sentry/views/detectors/components/details/cron';
import {ErrorDetectorDetails} from 'sentry/views/detectors/components/details/error';
import {FallbackDetectorDetails} from 'sentry/views/detectors/components/details/fallback';
import {MetricDetectorDetails} from 'sentry/views/detectors/components/details/metric';
import {MobileBuildDetectorDetails} from 'sentry/views/detectors/components/details/mobileBuild';
import {UptimeDetectorDetails} from 'sentry/views/detectors/components/details/uptime';
import {detectorToLLMContext} from 'sentry/views/detectors/utils/detectorLLMContext';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

type DetectorDetailsContentProps = {
  detector: Detector;
  project: Project;
};

function DetectorDetailsContentInner({detector, project}: DetectorDetailsContentProps) {
  useLLMContext({
    contextHint:
      'Sentry monitor detail page. A monitor watches one signal — a metric query, a cron ' +
      "check-in, an uptime check, a project's errors, or a mobile build size — and opens issues " +
      'when it fires. config holds the detection settings for this monitor type only, so its ' +
      'shape differs per type. connectedAlertIds are the alerts this monitor notifies through; ' +
      'they are `workflows` in the API. Use search_events or issue search scoped to this project ' +
      'to see what the monitor has actually been firing on.',
    ...detectorToLLMContext(detector, project.slug),
  });

  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      // Metric issue detectors do not support time period filters since the interval dictates what time periods are available.
      return <MetricDetectorDetails detector={detector} />;
    case 'uptime_domain_failure':
      return (
        <PageFiltersContainer>
          <UptimeDetectorDetails detector={detector} project={project} />
        </PageFiltersContainer>
      );
    case 'error':
      return (
        <PageFiltersContainer>
          <ErrorDetectorDetails detector={detector} project={project} />
        </PageFiltersContainer>
      );
    case 'monitor_check_in_failure':
      return (
        <PageFiltersContainer>
          <CronDetectorDetails detector={detector} project={project} />
        </PageFiltersContainer>
      );
    case 'issue_stream':
      return (
        <Alert.Container>
          <Alert variant="danger">
            {t('Issue stream monitors do not support detail views.')}
          </Alert>
        </Alert.Container>
      );
    case 'preprod_size_analysis':
      return (
        <PageFiltersContainer>
          <MobileBuildDetectorDetails detector={detector} />
        </PageFiltersContainer>
      );
    default:
      unreachable(detectorType);
      return (
        <PageFiltersContainer>
          <FallbackDetectorDetails detector={detector} />
        </PageFiltersContainer>
      );
  }
}

export const DetectorDetailsContent = registerLLMContext(
  'monitor-detail',
  DetectorDetailsContentInner
);
