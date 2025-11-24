import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Grid} from '@sentry/scraps/layout';

import {GroupPriorityBadge} from 'sentry/components/badge/groupPriority';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  FilterWrapper,
  ProvidedFormattedQuery,
} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  DataConditionType,
  DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL,
  DetectorPriorityLevel,
} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
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

function DetectorPriorities({detector}: {detector: MetricDetector}) {
  if (detector.config.detectionType === 'dynamic') {
    return <div>{t('Sentry will automatically update priority.')}</div>;
  }

  const conditions = detector.conditionGroup?.conditions || [];

  // Filter out OK conditions and sort by priority level
  const priorityConditions = conditions
    .filter(condition => condition.conditionResult !== DetectorPriorityLevel.OK)
    .sort((a, b) => (a.conditionResult || 0) - (b.conditionResult || 0));

  if (priorityConditions.length === 0) {
    return null;
  }

  const getConditionLabel = (condition: (typeof priorityConditions)[0]) => {
    const comparisonValue =
      typeof condition.comparison === 'number' ? String(condition.comparison) : '';
    const unit = getMetricDetectorSuffix(
      detector.config.detectionType,
      detector.dataSources[0].queryObj?.snubaQuery?.aggregate || 'count()'
    );

    if (detector.config.detectionType === 'percent') {
      const direction =
        condition.type === DataConditionType.GREATER ? t('higher') : t('lower');
      const delta = detector.config.comparisonDelta;
      const ago = t('than the previous %s', getExactDuration(delta));
      return `${comparisonValue}${unit} ${direction} ${ago}`;
    }

    const typeLabel =
      condition.type === DataConditionType.GREATER ? t('Above') : t('Below');
    return `${typeLabel} ${comparisonValue}${unit}`;
  };

  return (
    <Grid columns="1fr auto auto" width="fit-content" align="center" gap="sm">
      {priorityConditions.map((condition, index) => (
        <Fragment key={index}>
          <div>{getConditionLabel(condition)}</div>
          <IconArrow direction="right" />
          <GroupPriorityBadge
            showLabel
            priority={
              DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL[
                condition.conditionResult as keyof typeof DETECTOR_PRIORITY_LEVEL_TO_PRIORITY_LEVEL
              ]
            }
          />
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
  color: ${p => p.theme.subText};
  justify-self: flex-end;
  margin: 0;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const Value = styled('dl')`
  word-break: break-all;
  margin: 0;
`;
