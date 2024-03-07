import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {SiblingAutogroupNode} from '../../traceTree';

import {DetailContainer, IconTitleWrapper, StyledIconBorder, StyledTable} from './styles';

export function SiblingAutogroupNodeDetails({node}: {node: SiblingAutogroupNode}) {
  return (
    <DetailContainer>
      <IconTitleWrapper>
        <StyledIconBorder>
          <IconGroup color="blue300" size="md" />
        </StyledIconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Auto-Group')}</div>
      </IconTitleWrapper>

      <StyledTable className="table key-value">
        <tbody>
          <Row title={t('Grouping Logic')}>
            {t('5 or more sibling spans with the same operation and description.')}
          </Row>
          <Row title={t('Group Count')}>{node.groupCount}</Row>
          <Row title={t('Grouping Key')}>
            {tct('Span operation: [operation] and description: [description]', {
              operation: node.value.op,
              description: node.value.description,
            })}
          </Row>
        </tbody>
      </StyledTable>
    </DetailContainer>
  );
}
