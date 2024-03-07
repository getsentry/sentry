import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {MissingInstrumentationNode} from '../../traceTree';

import {DetailContainer, IconTitleWrapper, StyledIconBorder, StyledTable} from './styles';

export function MissingInstrumentationNodeDetails({
  node,
}: {
  node: MissingInstrumentationNode;
}) {
  return (
    <DetailContainer>
      <IconTitleWrapper>
        <StyledIconBorder>
          <IconSpan color="blue300" size="md" />
        </StyledIconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Missing Instrumentation Span')}</div>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={t('Gap Duration')}>
            {getDuration(node.value.timestamp - node.value.start_timestamp, 2, true)}
          </Row>
          <Row title={t('Previous Span')}>
            {node.previous.value.op} - {node.previous.value.description}
          </Row>
          <Row title={t('Next Span')}>
            {node.next.value.op} - {node.next.value.description}
          </Row>
        </tbody>
      </StyledTable>
    </DetailContainer>
  );
}
