import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

import {
  DetailContainer,
  IconTitleWrapper,
  StyledButton,
  StyledIconBorder,
  StyledTable,
} from './styles';

export function ErrorNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.TraceError>;
  organization: Organization;
}) {
  return (
    <DetailContainer>
      <IconTitleWrapper>
        <StyledIconBorder errored>
          <IconFire color="errorText" size="md" />
        </StyledIconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Error')}</div>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row
            title={t('Title')}
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
    </DetailContainer>
  );
}
