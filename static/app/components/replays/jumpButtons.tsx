import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import toPixels from 'sentry/utils/number/toPixels';

interface Props {
  jump: undefined | 'up' | 'down';
  onClick: () => void;
  tableHeaderHeight: number;
}

const offsetFromEdge = 5;

export default function JumpButtons({jump, onClick, tableHeaderHeight}: Props) {
  if (jump === 'up') {
    return (
      <JumpButton
        onClick={onClick}
        aria-label={t('Jump Up')}
        priority="primary"
        size="xs"
        style={{top: toPixels(tableHeaderHeight + offsetFromEdge)}}
      >
        {t('↑ Jump to current timestamp')}
      </JumpButton>
    );
  }
  if (jump === 'down') {
    return (
      <JumpButton
        onClick={onClick}
        aria-label={t('Jump Down')}
        priority="primary"
        size="xs"
        style={{bottom: toPixels(offsetFromEdge)}}
      >
        {t('↓ Jump to current timestamp')}
      </JumpButton>
    );
  }
  return null;
}

const JumpButton = styled(Button)`
  position: absolute;
  justify-self: center;
`;
