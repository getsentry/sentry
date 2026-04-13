import styled from '@emotion/styled';

export const CountTooltipContent = styled('dl')`
  display: grid;
  grid-template-columns: 1fr minmax(auto, max-content);
  gap: ${p => p.theme.space.md} ${p => p.theme.space['2xl']};
  text-align: left;
  align-items: start;
  margin-bottom: 0;
  white-space: nowrap;
`;
