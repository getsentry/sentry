import styled from '@emotion/styled';

import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {SiblingAutogroupNode} from '../../traceTree';

export default function SiblingAutogroupNodeDetails({
  node,
}: {
  node: SiblingAutogroupNode;
}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledGroupIconBorder>
          <IconGroup color="blue300" size="md" />
        </StyledGroupIconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Auto-Group')}</div>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={<TransactionIdTitle>{t('Grouping Logic')}</TransactionIdTitle>}>
            {t('5 or more sibling spans with the same operation and description.')}
          </Row>
          <Row title={<TransactionIdTitle>{t('Group Count')}</TransactionIdTitle>}>
            {node.groupCount}
          </Row>
          <Row title={<TransactionIdTitle>{t('Grouping Key')}</TransactionIdTitle>}>
            {tct('Span operation: [operation] and description: [description]', {
              operation: node.value.op,
              description: node.value.description,
            })}
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
