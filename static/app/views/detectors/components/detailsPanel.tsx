import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector, SnubaQueryDataSource} from 'sentry/types/workflowEngine/detectors';
import {getExactDuration} from 'sentry/utils/duration/getExactDuration';

interface DetailsPanelProps {
  detector: Detector;
}

function SnubaQueryDetails({dataSource}: {dataSource: SnubaQueryDataSource}) {
  if (!dataSource.queryObj) {
    return <Container>{t('Query not found.')}</Container>;
  }

  return (
    <Container>
      <Flex direction="column" gap={space(0.5)}>
        <Heading>{t('Query:')}</Heading>
        <Query>
          <Label>{t('visualize:')}</Label>
          <Value>{dataSource.queryObj.snubaQuery.aggregate}</Value>
          {dataSource.queryObj.snubaQuery.query && (
            <Fragment>
              <Label>{t('where:')}</Label>
              <Value>{dataSource.queryObj.snubaQuery.query}</Value>
            </Fragment>
          )}
        </Query>
      </Flex>
      <Flex gap={space(0.5)} align="center">
        <Heading>{t('Threshold:')}</Heading>
        <Value>{getExactDuration(dataSource.queryObj.snubaQuery.timeWindow, true)}</Value>
      </Flex>
    </Container>
  );
}

function DetailsPanel({detector}: DetailsPanelProps) {
  const dataSource = detector.dataSources?.[0];
  if (dataSource?.type === 'snuba_query_subscription') {
    return <SnubaQueryDetails dataSource={dataSource} />;
  }

  return (
    <Container>
      <Flex direction="column" gap={space(0.5)}>
        <Heading>{t('Query:')}</Heading>
        <Query>
          <Label>{t('visualize:')}</Label> <Value>placeholder</Value>
          <Label>{t('where:')}</Label> <Value>placeholder</Value>
        </Query>
      </Flex>
      <Heading>{t('Threshold:')}</Heading>
    </Container>
  );
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

export default DetailsPanel;
