import styled from '@emotion/styled';

interface Props {
  lineSize?: number;
  size?: number;
}
export function Liner({size = 10, lineSize = 1}: Props) {
  const css = {
    '--size': `${size}px`,
    '--halfSize': `${size / 2}px`,
    '--line': `${lineSize}px`,
    '--halfLine': `${lineSize / 2}px`,
  };
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
  border: 1px solid ${p => p.theme.gray400};
  background-color: #fff;
  position: absolute;
  top: calc(50% - var(--halfSize));
  left: calc(50% - var(--halfSize));
`;
