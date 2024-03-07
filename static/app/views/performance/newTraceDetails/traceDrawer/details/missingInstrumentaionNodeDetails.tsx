import styled from '@emotion/styled';

import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {MissingInstrumentationNode} from '../../traceTree';

export default function MissingInstrumentationNodeDetails({
  node,
}: {
  node: MissingInstrumentationNode;
}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledGroupIconBorder>
          <IconSpan color="blue300" size="lg" />
        </StyledGroupIconBorder>
        <h2>{t('Missing Instrumentation Span')}</h2>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Gap Duration')}</TransactionIdTitle>}>
            {getDuration(node.value.timestamp - node.value.start_timestamp, 2, true)}
          </Row>
          <Row title={<TransactionIdTitle>{t('Previous Span')}</TransactionIdTitle>}>
            {node.previous.value.op} - {node.previous.value.description}
          </Row>
          <Row title={<TransactionIdTitle>{t('Next Span')}</TransactionIdTitle>}>
            {node.next.value.op} - {node.next.value.description}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const IconTitleWrapper = styled(FlexBox)`
  gap: ${space(1)};
`;

const TransactionIdTitle = styled('a')`
  display: flex;
  color: ${p => p.theme.textColor};
  :hover {
    color: ${p => p.theme.textColor};
  }
`;

const StyledTable = styled('table')`
  margin-bottom: 0 !important;
`;

const StyledGroupIconBorder = styled('div')`
  border: 1px solid ${p => p.theme.blue300};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1)} 3px ${space(1)};
  margin-bottom: ${space(2)};
`;
