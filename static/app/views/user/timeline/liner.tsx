import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

interface Props {
  type: 'replay' | 'error' | 'transaction' | 'default';
  lineSize?: number;
  size?: number;
}
export function Liner({type, size = 10, lineSize = 1}: Props) {
  const theme = useTheme();

  const css = {
    '--size': `${size}px`,
    '--halfSize': `${size / 2}px`,
    '--line': `${lineSize}px`,
    '--halfLine': `${lineSize / 2}px`,
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

  return (
    <Wrapper style={css}>
      <Line style={css} />
      <Dot style={css} />
    </Wrapper>
  );
}
const Wrapper = styled('div')`
  position: relative;
  width: var(--size);
`;

const Line = styled('div')`
  background-color: ${p => p.theme.gray400};
  width: var(--line);
  position: absolute;
  left: calc(50% - var(--halfLine));
  height: 100%;
`;

const Dot = styled('div')`
  border-radius: 100%;
  height: var(--size);
  width: var(--size);
  border: 1px solid var(--color);
  background-color: var(--invertColor);
  position: absolute;
  top: calc(50% - var(--halfSize));
  left: calc(50% - var(--halfSize));
`;
