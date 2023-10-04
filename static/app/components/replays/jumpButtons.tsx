import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';

interface Props {
  jump: undefined | 'up' | 'down';
  onClick: () => void;
}

export default function JumpButtons({jump, onClick}: Props) {
  if (jump === 'up') {
    return (
      <JumpButton
        onClick={onClick}
        aria-label={t('Jump Up')}
        priority="primary"
        size="xs"
        style={{top: '30px'}}
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
        style={{bottom: '5px'}}
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
