import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {
  PREPROD_DETECTOR_FORM_FIELDS,
  usePreprodDetectorFormField,
} from 'sentry/views/detectors/components/forms/mobileBuild/mobileBuildFormData';
import {
  getMetricLabelForPlatform,
  guessPlatformForProject,
} from 'sentry/views/settings/project/preprod/types';

export function MobileBuildPreviewSection() {
  const measurement =
    usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.measurement) ??
    'install_size';
  const highThreshold = usePreprodDetectorFormField(
    PREPROD_DETECTOR_FORM_FIELDS.highThreshold
  );
  const thresholdType = usePreprodDetectorFormField(
    PREPROD_DETECTOR_FORM_FIELDS.thresholdType
  );
  const projectId = usePreprodDetectorFormField(PREPROD_DETECTOR_FORM_FIELDS.projectId);
  const {projects} = useProjects();

  const project = projects.find(p => p.id === projectId);
  const maybePlatform = project && guessPlatformForProject(project);
  const metricLabel = getMetricLabelForPlatform(measurement, maybePlatform);

  const isPercentage = thresholdType === 'relative_diff';
  const thresholdUnit = isPercentage ? '%' : 'MB';

  const threshold = Number(highThreshold);
  const regression = isPercentage ? 0.05 : 1;
  const actual = threshold === undefined ? undefined : threshold + regression;

  const actualDisplay = actual ? `${actual} ${thresholdUnit}` : '\u2026';
  const thresholdDisplay = highThreshold ? `${threshold} ${thresholdUnit}` : '\u2026';

  return (
    <DetectorIssuePreview
      issueTitle={t('%s threshold exceeded', metricLabel)}
      project={project}
      subtitle={t('%s > %s Threshold', actualDisplay, thresholdDisplay)}
    />
  );
}
