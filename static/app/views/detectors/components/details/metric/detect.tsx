import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  MetricDetector,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';
import {getDetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';

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
      <Flex direction="column" gap="xs">
        <Heading>{t('Query:')}</Heading>
        <Query>
          <Label>{t('visualize:')}</Label>
          <Value>
            {datasetConfig.fromApiAggregate(dataSource.queryObj.snubaQuery.aggregate)}
          </Value>
          {query && (
            <Fragment>
              <Label>{t('where:')}</Label>
              <Value>{query}</Value>
            </Fragment>
          )}
        </Query>
      </Flex>
      <Flex gap="xs" align="center">
        <Heading>{t('Threshold:')}</Heading>
        <Value>{getExactDuration(dataSource.queryObj.snubaQuery.timeWindow, true)}</Value>
      </Flex>
    </Container>
  );
}

export function MetricDetectorDetailsDetect({detector}: MetricDetectorDetectProps) {
  const dataSource = detector.dataSources?.[0];
  return <SnubaQueryDetails dataSource={dataSource} />;
}

const Heading = styled('h4')`
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
`;

const Query = styled('dl')`
  display: grid;
  grid-template-columns: auto auto;
  width: fit-content;
  gap: ${space(0.25)} ${space(0.5)};
  margin: 0;
`;

const Label = styled('dt')`
  color: ${p => p.theme.subText};
  justify-self: flex-end;
  margin: 0;
`;

const Value = styled('dl')`
  word-break: break-all;
  margin: 0;
`;
