import styled from '@emotion/styled';

import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {Frame} from 'app/types';

type Props = {
  leadsToApp: boolean;
  isExpanded?: boolean;
  nextFrame?: Frame;
};

function LeadHint({leadsToApp, isExpanded, nextFrame}: Props) {
  if (isExpanded || !leadsToApp) {
    return null;
  }

  return (
    <Wrapper className="leads-to-app-hint" width={!nextFrame ? '115px' : ''}>
      {!nextFrame ? t('Crashed in non-app') : t('Called from')}
      {': '}
    </Wrapper>
  );
}

export default LeadHint;

const Wrapper = styled('div')<{width?: string}>`
  ${overflowEllipsis}
  max-width: ${p => (p.width ? p.width : '67px')}
`;
