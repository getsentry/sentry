import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import Detail from 'sentry/views/starfish/components/detailPanel';

type EndpointAggregateDetails = {
  failureCount: number;
  p50: number;
  tpm: number;
  failureRate?: number;
  failureRateDelta?: number;
  p50Delta?: number;
};

export type EndpointDataRow = {
  aggregateDetails: EndpointAggregateDetails;
  endpoint: string;
};

type EndpointDetailBodyProps = {
  row: EndpointDataRow;
};

export default function EndpointDetail({
  row,
  onClose,
}: Partial<EndpointDetailBodyProps> & {onClose: () => void}) {
  if (isNil(row)) {
    return null;
  }
  return (
    <Detail detailKey={row?.endpoint} onClose={onClose}>
      {row && <EndpointDetailBody row={row} />}
    </Detail>
  );
}

function EndpointDetailBody({row}: EndpointDetailBodyProps) {
  const {aggregateDetails} = row;
  return (
    <div>
      <h2>{t('Endpoint Detail')}</h2>
      <p>{t('Details of endpoint. More breakdowns, etc. Maybe some trends?')}</p>
      <SubHeader>{t('Endpoint URL')}</SubHeader>
      <pre>{row?.endpoint}</pre>
      <FlexRowContainer>
        <FlexRowItem>
          <SubHeader>{t('Throughput')}</SubHeader>
          <SubSubHeader>{formatAbbreviatedNumber(aggregateDetails.tpm)}</SubSubHeader>
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('p50(duration)')}</SubHeader>
          <SubSubHeader>{getDuration(aggregateDetails.p50 / 1000, 0, true)}</SubSubHeader>
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Failure Count')}</SubHeader>
          <SubSubHeader>
            {formatAbbreviatedNumber(aggregateDetails.failureCount)}
          </SubSubHeader>
        </FlexRowItem>
        <FlexRowItem>
          <SubHeader>{t('Failure Rate')}</SubHeader>
          <SubSubHeader>{'0.5%'}</SubSubHeader>
        </FlexRowItem>
      </FlexRowContainer>
    </div>
  );
}

const SubHeader = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeLarge};
  margin: 0;
  margin-bottom: ${space(1)};
`;

const SubSubHeader = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const FlexRowContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
`;

const FlexRowItem = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
