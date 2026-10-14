import styled from '@emotion/styled';

/** Label typography shared by dropdown and select menu sections. */
export const MenuSectionLabel = styled('span')`
  color: ${p => p.theme.tokens.interactive.transparent.neutral.content.headings};
  font-family: ${p => p.theme.font.family.sans};
  font-size: ${p => p.theme.font.size.sm};
  font-style: normal;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-variant-numeric: lining-nums tabular-nums;
  line-height: 16px;
`;
