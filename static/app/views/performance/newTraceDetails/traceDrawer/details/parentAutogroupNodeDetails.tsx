import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {ParentAutogroupNode} from '../../traceTree';

import {DetailContainer, IconTitleWrapper, StyledIconBorder, StyledTable} from './styles';

export function ParentAutogroupNodeDetails({node}: {node: ParentAutogroupNode}) {
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
            {t(
              'Chain of immediate and only children spans with the same operation as their parent.'
            )}
          </Row>
          <Row title={t('Group Count')}>{node.groupCount}</Row>
          <Row title={t('Grouping Key')}>
            {t('Span Operation')} : {node.value.op}
          </Row>
        </tbody>
      </StyledTable>
    </DetailContainer>
  );
}
