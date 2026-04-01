import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import {KeyValueList} from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {Event, EventOccurrence} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';
import {defined} from 'sentry/utils';
import {useOrganization} from 'sentry/utils/useOrganization';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {getCompareBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  bytesToMB,
  getDisplayUnit,
  getMeasurementLabel,
  getMetricLabelForArtifactType,
  isDiffThreshold,
} from 'sentry/views/settings/project/preprod/types';
import type {
  MeasurementType,
  MetricType,
} from 'sentry/views/settings/project/preprod/types';

interface SizeAnalysisEvidenceData {
  conditions: MetricCondition[];
  config: {
    measurement: MetricType;
    thresholdType: MeasurementType;
    query?: string;
  };
  detectorId: number;
  headArtifactId: number;
  value: number;
  baseArtifactId?: number;
  baseSizeMetricId?: number;
  headSizeMetricId?: number;
}

function isSizeAnalysisEvidenceData(
  evidenceData?: EventOccurrence['evidenceData']
): evidenceData is SizeAnalysisEvidenceData {
  if (!defined(evidenceData) || !('config' in evidenceData)) {
    return false;
  }

  const {config} = evidenceData;
  return (
    defined(config) &&
    typeof config === 'object' &&
    'thresholdType' in config &&
    'measurement' in config &&
    'headArtifactId' in evidenceData
  );
}

function formatRawValueWithUnit(value: number, thresholdType: MeasurementType): string {
  if (thresholdType === 'relative_diff') {
    return `${value}%`;
  }
  const mb = parseFloat(bytesToMB(value).toFixed(2));
  return `${mb} ${getDisplayUnit(thresholdType)}`;
}

function formatEvaluatedValue(value: number, thresholdType: MeasurementType): string {
  const prefix = isDiffThreshold(thresholdType) ? '+' : '';
  return `${prefix}${formatRawValueWithUnit(value, thresholdType)}`;
}

function formatCondition({
  condition,
  thresholdType,
  measurementLabel,
}: {
  condition: MetricCondition;
  measurementLabel: string;
  thresholdType: MeasurementType;
}): string {
  const label = isDiffThreshold(thresholdType)
    ? `${measurementLabel} Diff`
    : measurementLabel;
  const comparisonValue =
    typeof condition.comparison === 'number'
      ? formatRawValueWithUnit(condition.comparison, thresholdType)
      : '';
  return `${label} > ${comparisonValue}`;
}

interface SizeAnalysisTriggeredSectionProps {
  event: Event;
  group: Group;
}

export function SizeAnalysisTriggeredSection({event}: SizeAnalysisTriggeredSectionProps) {
  const organization = useOrganization();
  const evidenceData = event.occurrence?.evidenceData;

  if (!isSizeAnalysisEvidenceData(evidenceData)) {
    return null;
  }

  const {conditions, config, value, headArtifactId, baseArtifactId} = evidenceData;
  const triggeredCondition = conditions[0];
  const artifactType = event.tags?.find(({key}) => key === 'head.artifact_type')?.value;
  const measurementLabel = getMetricLabelForArtifactType(
    config.measurement,
    artifactType
  );
  const hasDiffThreshold = isDiffThreshold(config.thresholdType);

  const headBuildPath = `/organizations/${organization.slug}/preprod/size/${headArtifactId}/`;

  const compareBuildPath =
    hasDiffThreshold && defined(baseArtifactId)
      ? getCompareBuildPath({
          organizationSlug: organization.slug,
          headArtifactId: String(headArtifactId),
          baseArtifactId: String(baseArtifactId),
        })
      : null;

  return (
    <InterimSection
      title={t('Triggered Condition')}
      type="triggered_condition"
      actions={
        <Flex gap="xs">
          <LinkButton size="xs" to={headBuildPath}>
            {t('Open Build')}
          </LinkButton>
          {compareBuildPath && (
            <LinkButton size="xs" to={compareBuildPath}>
              {t('Open Comparison')}
            </LinkButton>
          )}
        </Flex>
      }
    >
      <KeyValueList
        shouldSort={false}
        data={[
          {
            key: 'thresholdType',
            value: getMeasurementLabel(config.thresholdType),
            subject: t('Threshold Type'),
          },
          {
            key: 'measurement',
            value: measurementLabel,
            subject: t('Measurement'),
          },
          ...(config.query
            ? [
                {
                  key: 'query',
                  value: config.query,
                  subject: t('Query'),
                },
              ]
            : []),
          ...(triggeredCondition
            ? [
                {
                  key: 'condition',
                  value: (
                    <pre>
                      {formatCondition({
                        condition: triggeredCondition,
                        thresholdType: config.thresholdType,
                        measurementLabel,
                      })}
                    </pre>
                  ),
                  subject: t('Condition'),
                },
              ]
            : []),
          {
            key: 'value',
            value: formatEvaluatedValue(value, config.thresholdType),
            subject: t('Evaluated Value'),
          },
        ]}
      />
    </InterimSection>
  );
}
