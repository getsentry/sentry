import {Fragment} from 'react';

import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  FilterWrapper,
  ProvidedFormattedQuery,
} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  MetricDetector,
} from 'sentry/types/workflowEngine/detectors';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {AggregateSummaryTable} from 'sentry/views/detectors/components/details/metric/aggregateSummaryTable';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {
  getSensitivityLabel,
  getThresholdTypeLabel,
  isAnomalyDetectionComparison,
} from 'sentry/views/detectors/utils/anomalyDetectionLabels';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';
import {percentThresholdAbsoluteToDelta} from 'sentry/views/detectors/utils/percentThreshold';

function getDetectorTypeLabel(detector: MetricDetector) {
  if (detector.config.detectionType === 'dynamic') {
    return t('Dynamic threshold');
  }
  if (detector.config.detectionType === 'percent') {
    return t('Percent change');
  }
  return t('Static threshold');
}

function getConditionLabel({condition}: {condition: MetricCondition}) {
  switch (condition.conditionResult) {
    case DetectorPriorityLevel.OK:
      return t('Resolved');
    case DetectorPriorityLevel.LOW:
      return t('Low');
    case DetectorPriorityLevel.MEDIUM:
      return t('Medium');
    case DetectorPriorityLevel.HIGH:
      return t('High');
    default:
      return t('Unknown');
  }
}

function makeDirectionText(condition: MetricCondition) {
  switch (condition.type) {
    case DataConditionType.GREATER:
      return t('Above');
    case DataConditionType.LESS:
      return t('Below');
    case DataConditionType.EQUAL:
      return t('Equal to');
    case DataConditionType.NOT_EQUAL:
      return t('Not equal to');
    case DataConditionType.GREATER_OR_EQUAL:
      return t('Above or equal to');
    case DataConditionType.LESS_OR_EQUAL:
      return t('Below or equal to');
    default:
      return t('Unknown');
  }
}

export function getConditionDescription({
  aggregate,
  config,
  condition,
}: {
  aggregate: string;
  condition: MetricCondition;
  config: MetricDetector['config'];
}) {
  const unit = getMetricDetectorSuffix(config.detectionType, aggregate);

  if (config.detectionType === 'dynamic') {
    if (isAnomalyDetectionComparison(condition.comparison)) {
      const sensitivityLabel = getSensitivityLabel(condition.comparison.sensitivity);
      const directionLabel = getThresholdTypeLabel(condition.comparison.thresholdType);
      return (
        <Stack>
          <div>{t('Trend: %(direction)s', {direction: directionLabel})}</div>
          <div>
            {t('Responsiveness: %(sensitivity)s', {
              sensitivity: sensitivityLabel,
            })}
          </div>
        </Stack>
      );
    }
    return t('Dynamic threshold');
  }

  // This should never happen, but we need to narrow the type
  if (typeof condition.comparison !== 'number') {
    return t('Invalid comparison value');
  }

  if (config.detectionType === 'percent') {
    const direction = condition.comparison >= 100 ? t('higher') : t('lower');
    const deltaComparison = percentThresholdAbsoluteToDelta(condition.comparison);
    const timeRange = getExactDuration(config.comparisonDelta);

    if (condition.conditionResult === DetectorPriorityLevel.OK) {
      return t(
        'Below or equal to %(comparisonValue)s%(unit)s %(direction)s than the previous %(timeRange)s',
        {
          comparisonValue: deltaComparison,
          unit,
          direction,
          timeRange,
        }
      );
    }

    return t(
      '%(comparisonValue)s%(unit)s %(direction)s than the previous %(timeRange)s',
      {
        comparisonValue: deltaComparison,
        unit,
        direction,
        timeRange,
      }
    );
  }

  return `${makeDirectionText(condition)} ${condition.comparison}${unit}`;
}

function DetectorPriorities({detector}: {detector: MetricDetector}) {
  const conditions = detector.conditionGroup?.conditions || [];

  return (
    <Grid columns="auto 1fr" gap="sm lg" align="start">
      {conditions.map((condition, index) => (
        <Fragment key={index}>
          <Flex align="center" gap="sm">
            <PriorityDot
              priority={
                condition.conditionResult === DetectorPriorityLevel.OK
                  ? 'resolved'
                  : DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[
                      condition.conditionResult as keyof typeof DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL
                    ]
              }
            />
            <Text>{getConditionLabel({condition})}</Text>
          </Flex>
          <Text>
            {getConditionDescription({
              aggregate: detector.dataSources[0].queryObj.snubaQuery.aggregate,
              condition,
              config: detector.config,
            })}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}

export function MetricDetectorDetailsDetect({detector}: {detector: MetricDetector}) {
  const dataSource = detector.dataSources[0];

  if (!dataSource.queryObj) {
    return <Container>{t('Query not found.')}</Container>;
  }

  const datasetConfig = getDatasetConfig(
    getDetectorDataset(
      dataSource.queryObj.snubaQuery.dataset,
      dataSource.queryObj.snubaQuery.eventTypes
    )
  );
  const query = datasetConfig.toSnubaQueryString(dataSource.queryObj.snubaQuery);

  const {aggregate} = dataSource.queryObj.snubaQuery;
  const aggregateText = datasetConfig.fromApiAggregate(aggregate);
  // Datasets may summarize the aggregate (e.g. "A + B"), broken out on hover.
  const aggregateSummary = datasetConfig.getAggregateSummary?.(aggregate);

  return (
    <Container>
      <Stack gap="md">
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Dataset:')}</Heading>
          <Text wordBreak="break-all">{datasetConfig.name}</Text>
        </Flex>
        <Heading as="h4">{t('Query:')}</Heading>
        <DescriptionList gap="sm xs">
          <DescriptionList.Term>{t('Visualize')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Flex>
              {aggregateSummary ? (
                <Tooltip
                  title={<AggregateSummaryTable summary={aggregateSummary} />}
                  maxWidth={400}
                >
                  <FilterWrapper>{aggregateSummary.expression}</FilterWrapper>
                </Tooltip>
              ) : (
                <FilterWrapper>{aggregateText}</FilterWrapper>
              )}
            </Flex>
          </DescriptionList.Details>
          {query && (
            <Fragment>
              <DescriptionList.Term>{t('Where')}</DescriptionList.Term>
              <DescriptionList.Details>
                <Tooltip
                  showOnlyOnOverflow
                  title={<ProvidedFormattedQuery query={query} />}
                  maxWidth={400}
                >
                  <ProvidedFormattedQuery query={query} />
                </Tooltip>
              </DescriptionList.Details>
            </Fragment>
          )}
        </DescriptionList>
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Interval:')}</Heading>
          <Text wordBreak="break-all">
            {getExactDuration(dataSource.queryObj.snubaQuery.timeWindow)}
          </Text>
        </Flex>
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Threshold:')}</Heading>
          <Text wordBreak="break-all">{getDetectorTypeLabel(detector)}</Text>
        </Flex>
        <DetectorPriorities detector={detector} />
      </Stack>
    </Container>
  );
}
