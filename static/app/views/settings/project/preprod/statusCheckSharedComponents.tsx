import styled from '@emotion/styled';

export const SectionLabel = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.onVibrant.light};
  background: ${p => p.theme.tokens.background.accent.vibrant};
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.md};
  border-radius: ${p => p.theme.radius.md};
  width: fit-content;
`;
