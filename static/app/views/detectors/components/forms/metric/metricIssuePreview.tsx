import {t} from 'sentry/locale';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import {getDuration} from 'sentry/utils/duration/getDuration';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {IssuePreviewSection} from 'sentry/views/detectors/components/forms/common/issuePreviewSection';
import {ownerToActor} from 'sentry/views/detectors/components/forms/common/ownerToActor';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

function useMetricIssuePreviewSubtitle() {
  const detectionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.detectionType
  );
  const aggregate = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const interval = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.interval);
  const highThreshold = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.highThreshold
  );
  const conditionType = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionType
  );
  const conditionComparisonAgo = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.conditionComparisonAgo
  );

  const datasetConfig = getDatasetConfig(dataset);
  const formattedAggregate =
    datasetConfig.formatAggregateForTitle?.(aggregate) ?? aggregate;
  const intervalLabel = getDuration(interval);
  const thresholdLabel = highThreshold || t('...');

  switch (detectionType) {
    case 'static': {
      const direction =
        conditionType === DataConditionType.LESS ? t('below') : t('above');
      const suffix = getMetricDetectorSuffix('static', aggregate);
      return t(
        'Critical: %(aggregate)s %(direction)s %(threshold)s%(suffix)s in %(interval)s',
        {
          aggregate: formattedAggregate,
          direction,
          threshold: thresholdLabel,
          suffix,
          interval: intervalLabel,
        }
      );
    }
    case 'percent': {
      const direction =
        conditionType === DataConditionType.LESS ? t('lower') : t('higher');
      return t(
        'Critical: %(aggregate)s %(direction)s by %(threshold)s%% compared to past %(interval)s',
        {
          aggregate: formattedAggregate,
          direction,
          threshold: thresholdLabel,
          interval: getDuration(conditionComparisonAgo ?? interval),
        }
      );
    }
    case 'dynamic': {
      return t('Detected an anomaly in the query for %(aggregate)s', {
        aggregate: formattedAggregate,
      });
    }
    default:
      return t('Critical issue condition met');
  }
}

export function MetricIssuePreview({step}: {step?: number}) {
  const name = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.name);
  const owner = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.owner);
  const subtitle = useMetricIssuePreviewSubtitle();
  const assignee = ownerToActor(owner);
  const {project} = useDetectorFormContext();

  return (
    <IssuePreviewSection step={step}>
      <DetectorIssuePreview
        issueTitle={name || t('Monitor title')}
        subtitle={subtitle}
        assignee={assignee}
        project={project}
      />
    </IssuePreviewSection>
  );
}
