import styled from '@emotion/styled';

/* prettier-ignore */
export const ThreadSelectorGrid = styled('div')<{hasThreadStates: boolean}>`
  font-size: ${p => p.theme.font.size.sm};
  display: grid;
  gap: ${p => p.theme.space.xs};
  align-items: center;
  grid-template-columns: 16px 0.5fr repeat(${p => (p.hasThreadStates ? '2' : '1')}, 1fr) 1fr;
  min-height: 18px;
`;

export const ThreadSelectorGridCell = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
