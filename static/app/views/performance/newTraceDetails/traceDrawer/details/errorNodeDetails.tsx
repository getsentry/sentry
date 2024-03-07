import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {
  SpanDetailContainer,
  SpanDetails,
} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {DataSection} from 'sentry/components/events/styles';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

export default function ErrorNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.TraceError>;
  organization: Organization;
}) {
  return (
    <Wrapper>
      <IconTitleWrapper>
        <StyledErrorIconBorder>
          <IconFire color="errorText" size="md" />
        </StyledErrorIconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Error')}</div>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row
            title={<TransactionIdTitle>{t('Title')}</TransactionIdTitle>}
            extra={
              <StyledButton
                size="xs"
                to={generateIssueEventTarget(node.value, organization)}
              >
                {t('Go to Issue')}
              </StyledButton>
            }
          >
            {node.value.title}
          </Row>
        </tbody>
      </StyledTable>
    </Wrapper>
  );
}

const StyledButton = styled(Button)`
  position: absolute;
  top: ${space(0.75)};
  right: ${space(0.5)};
`;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};

  ${DataSection} {
    padding: 0;
  }

  ${SpanDetails} {
    padding: 0;
  }

  ${SpanDetailContainer} {
    border-bottom: none !important;
  }
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

const StyledErrorIconBorder = styled('div')`
  border: 1px solid ${p => p.theme.error};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1)} 3px ${space(1)};
`;
