import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  FilterWrapper,
  ProvidedFormattedQuery,
} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import type {
  MetricDetector,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';
import type {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

interface MetricDetectorDetectProps {
  detector: MetricDetector;
}

function SnubaQueryDetails({dataSource}: {dataSource: SnubaQueryDataSource}) {
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
      <Flex gap="xs" align="center">
        <Heading as="h4">{t('Dataset:')}</Heading>
        <Value>{datasetConfig.name}</Value>
      </Flex>
      <Flex direction="column" gap="xs">
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
        <Flex gap="xs" align="center">
          <Heading as="h4">{t('Interval:')}</Heading>
          <Value>{getExactDuration(dataSource.queryObj.snubaQuery.timeWindow)}</Value>
        </Flex>
      </Flex>
    </Container>
  );
}

export function MetricDetectorDetailsDetect({detector}: MetricDetectorDetectProps) {
  const dataSource = detector.dataSources?.[0];
  return <SnubaQueryDetails dataSource={dataSource} />;
}

const Query = styled('dl')`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: ${p => p.theme.space.sm} ${p => p.theme.space.xs};
  margin: 0;
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
