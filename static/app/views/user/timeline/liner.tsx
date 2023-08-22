import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {IconFire} from 'sentry/icons';

interface Props {
  speed: null | 'fast' | 'mid' | 'slow';
  type: 'replay' | 'error' | 'transaction' | 'default';
  lineSize?: number;
  size?: number;
}
export function Liner({type, size = 10, lineSize = 1, speed}: Props) {
  const theme = useTheme();

  const css = {
    '--size': `${size}px`,
    '--line': `${lineSize}px`,
    '--backgroundColor': `${theme.red100}`,
    '--color': `${theme.gray400}`,
    '--invertColor': `${theme.surface300}`,
  } as any;

  if (type === 'error') {
    css['--color'] = theme.red400;
    css['--invertColor'] = theme.red100_a;
  }

  if (type === 'default') {
    css['--color'] = theme.blue300;
    css['--invertColor'] = theme.blue100_a;
  }

  if (speed === 'fast') {
    css['--color'] = theme.green300;
    css['--invertColor'] = theme.green100_a;
  } else if (speed === 'mid') {
    css['--color'] = theme.yellow300;
    css['--invertColor'] = theme.yellow100_a;
  } else if (speed === 'slow') {
    css['--color'] = theme.red400;
    css['--invertColor'] = theme.red100_a;
  }

  return (
    <Wrapper style={css}>
      <Line />
      {type === 'error' ? (
        <IconWrapper>
          <ErrorIcon />
        </IconWrapper>
      ) : (
        <Dot />
      )}
    </Wrapper>
  );
}
const Wrapper = styled('div')`
  --size: var(--size);
  position: relative;
  width: var(--size);
  flex-shrink: 0;
`;

const Line = styled('div')`
  background-color: ${p => p.theme.gray200};
  width: var(--line);
  position: absolute;
  left: calc(50% - calc(var(--line) / 2));
  height: 100%;
`;

const Dot = styled('div')`
  border-radius: 100%;
  height: var(--size);
  width: var(--size);
  border: 1px solid var(--color);
  background-color: var(--invertColor);
  position: absolute;
  top: calc(50% - calc(var(--size) / 2));
  left: calc(50% - calc(var(--size) / 2));
`;

const IconWrapper = styled(Dot)`
  --size: 24px;
  background-color: ${p => p.theme.surface300};
  display: flex;
  align-items: center;
  justify-content: center;
  border-width: 2px;
`;

const ErrorIcon = styled(IconFire)`
  color: var(--color);
  height: calc(var(--size) - 8px);
  width: calc(var(--size) - 8px);
`;
