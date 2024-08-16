import styled from '@emotion/styled';

export function Divider() {
  return <DividerWrapper aria-hidden>{'|'}</DividerWrapper>;
}

/**
 * Using relative font size to match the font size of the parent element
 */
const DividerWrapper = styled('div')`
  color: ${p => p.theme.translucentBorder};
  font-size: 0.75em;
  display: flex;
  align-items: center;
  margin: 0 1px;
`;
