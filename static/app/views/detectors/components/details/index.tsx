import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import type {Project} from 'sentry/types/project';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {unreachable} from 'sentry/utils/unreachable';
import {CronDetectorDetails} from 'sentry/views/detectors/components/details/cron';
import {ErrorDetectorDetails} from 'sentry/views/detectors/components/details/error';
import {FallbackDetectorDetails} from 'sentry/views/detectors/components/details/fallback';
import {MetricDetectorDetails} from 'sentry/views/detectors/components/details/metric';
import {UptimeDetectorDetails} from 'sentry/views/detectors/components/details/uptime';

type DetectorDetailsContentProps = {
  detector: Detector;
  project: Project;
};

export function DetectorDetailsContent({detector, project}: DetectorDetailsContentProps) {
  const detectorType = detector.type;
  switch (detectorType) {
    case 'metric_issue':
      // Metric issue detectors do not support time period filters since the interval dictates what time periods are available.
      return <MetricDetectorDetails detector={detector} project={project} />;
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
    case 'uptime_subscription':
      return (
        <PageFiltersContainer>
          <CronDetectorDetails detector={detector} project={project} />
        </PageFiltersContainer>
      );
    default:
      unreachable(detectorType);
      return (
        <PageFiltersContainer>
          <FallbackDetectorDetails detector={detector} project={project} />
        </PageFiltersContainer>
      );
  }
}
