import styled from '@emotion/styled';

export const ConditionBadge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.tokens.background.accent.vibrant};
  padding: 0 ${p => p.theme.space.sm};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.colors.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.font.size.md};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  line-height: 1.5;
`;
