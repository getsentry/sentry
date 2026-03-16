import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FilterWrapper} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  PreprodDetector,
} from 'sentry/types/workflowEngine/detectors';
import {PriorityDot} from 'sentry/views/detectors/components/priorityDot';
import {
  bytesToMB,
  getDisplayUnit,
  getMeasurementLabel,
  getMetricLabel,
} from 'sentry/views/settings/project/preprod/types';

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

function formatComparisonValue(
  comparison: MetricCondition['comparison'],
  thresholdType: PreprodDetector['config']['thresholdType']
): string {
  if (typeof comparison !== 'number') {
    return '';
  }
  if (thresholdType === 'relative_diff') {
    return String(comparison);
  }
  return String(bytesToMB(comparison));
}

function getConditionDescription({
  condition,
  thresholdType,
}: {
  condition: MetricCondition;
  thresholdType: PreprodDetector['config']['thresholdType'];
}) {
  const comparisonValue = formatComparisonValue(condition.comparison, thresholdType);
  const unit = getDisplayUnit(thresholdType);

  if (condition.conditionResult === DetectorPriorityLevel.OK) {
    return t('Below or equal to %(value)s%(unit)s', {
      value: comparisonValue,
      unit,
    });
  }

  return t('Above %(value)s%(unit)s', {
    value: comparisonValue,
    unit,
  });
}

function DetectorPriorities({detector}: {detector: PreprodDetector}) {
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
              condition,
              thresholdType: detector.config.thresholdType,
            })}
          </Text>
        </Fragment>
      ))}
    </Grid>
  );
}

export function MobileBuildDetectorDetailsDetect({
  detector,
}: {
  detector: PreprodDetector;
}) {
  const filters: Array<{key: string; value: string}> = [];

  return (
    <Container>
      <Flex direction="column" gap="md">
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Measurement:')}</Heading>
          <Value>{getMetricLabel(detector.config.measurement)}</Value>
        </Flex>
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Threshold Type:')}</Heading>
          <Value>{getMeasurementLabel(detector.config.thresholdType)}</Value>
        </Flex>
        {filters.length > 0 && (
          <Fragment>
            <Heading as="h4">{t('Filters:')}</Heading>
            <Query>
              {filters.map((filter, index) => (
                <Fragment key={index}>
                  <Label>
                    <Text variant="muted">{filter.key}</Text>
                  </Label>
                  <Value>
                    <Flex>
                      <FilterWrapper>{filter.value}</FilterWrapper>
                    </Flex>
                  </Value>
                </Fragment>
              ))}
            </Query>
          </Fragment>
        )}
        <Flex gap="xs" align="baseline">
          <Heading as="h4">{t('Threshold:')}</Heading>
          <Value>{t('Static threshold')}</Value>
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
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;

const Value = styled('dl')`
  word-break: break-all;
  margin: 0;
`;
