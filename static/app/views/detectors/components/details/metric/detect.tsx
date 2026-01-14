import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Grid, Stack} from '@sentry/scraps/layout';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
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
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import {
  getSensitivityLabel,
  getThresholdTypeLabel,
  isAnomalyDetectionComparison,
} from 'sentry/views/detectors/utils/anomalyDetectionLabels';
import {getMetricDetectorSuffix} from 'sentry/views/detectors/utils/metricDetectorSuffix';

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
  const comparisonValue =
    typeof condition.comparison === 'number' ? String(condition.comparison) : '';
  const unit = getMetricDetectorSuffix(config.detectionType, aggregate);

  if (config.detectionType === 'dynamic') {
    if (isAnomalyDetectionComparison(condition.comparison)) {
      const sensitivityLabel = getSensitivityLabel(condition.comparison.sensitivity);
      const directionLabel = getThresholdTypeLabel(condition.comparison.thresholdType);
      return (
        <Stack>
          <div>{t('Trend: %(direction)s', {direction: directionLabel})}</div>
          <div>
            {t('Responsiveness: %(sensitivity)s', {sensitivity: sensitivityLabel})}
          </div>
        </Stack>
      );
    }
    return t('Dynamic threshold');
  }

  if (config.detectionType === 'percent') {
    const direction =
      condition.type === DataConditionType.GREATER ? t('higher') : t('lower');
    const delta = config.comparisonDelta;
    const timeRange = getExactDuration(delta);

    if (condition.conditionResult === DetectorPriorityLevel.OK) {
      return t(
        `Below or equal to %(comparisonValue)s%(unit)s %(direction)s than the previous %(timeRange)s`,
        {
          comparisonValue,
          unit,
          direction,
          timeRange,
        }
      );
    }

    return t(
      `%(comparisonValue)s%(unit)s %(direction)s than the previous %(timeRange)s`,
      {
        comparisonValue,
        unit,
        direction,
        timeRange,
      }
    );
  }

  return `${makeDirectionText(condition)} ${comparisonValue}${unit}`;
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

  return (
    <Container>
      <Flex direction="column" gap="md">
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Dataset:')}</Heading>
          <Value>{datasetConfig.name}</Value>
        </Flex>
        <Heading as="h4">{t('Query:')}</Heading>
        <Query>
          <Label>
            <Text variant="muted">{t('Visualize')}</Text>
          </Label>
          <Value>
            <Flex>
              <FilterWrapper>
                {datasetConfig.fromApiAggregate(dataSource.queryObj.snubaQuery.aggregate)}
              </FilterWrapper>
            </Flex>
          </Value>
          {query && (
            <Fragment>
              <Label>
                <Text variant="muted">{t('Where')}</Text>
              </Label>
              <Value>
                <Tooltip
                  showOnlyOnOverflow
                  title={<ProvidedFormattedQuery query={query} />}
                  maxWidth={400}
                >
                  <ProvidedFormattedQuery query={query} />
                </Tooltip>
              </Value>
            </Fragment>
          )}
        </Query>
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Interval:')}</Heading>
          <Value>{getExactDuration(dataSource.queryObj.snubaQuery.timeWindow)}</Value>
        </Flex>
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Threshold:')}</Heading>
          <Value>{getDetectorTypeLabel(detector)}</Value>
        </Flex>
        <DetectorPriorities detector={detector} />
      </Flex>
    </Container>
  );
}

const Query = styled('dl')`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: ${p => p.theme.space.sm} ${p => p.theme.space.xs};
  margin: 0;
  align-items: baseline;
`;

const Label = styled('dt')`
  color: ${p => p.theme.tokens.content.secondary};
  justify-self: flex-end;
  margin: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const Value = styled('dl')`
  word-break: break-all;
  margin: 0;
`;
