import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {Frame} from 'sentry/types';

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
  ${p => p.theme.overflowEllipsis}
  max-width: ${p => (p.width ? p.width : '67px')}
`;
