import styled from '@emotion/styled';

export const ReadoutRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  column-gap: ${p => p.theme.space(4)};
  row-gap: ${p => p.theme.space(2)};
`;

export const ToolRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space(2)};
`;
