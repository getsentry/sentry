import styled from '@emotion/styled';

export const Wrap = styled('div')`
  margin-bottom: ${p => p.theme.space['3xl']};
`;

export const Title = styled('h6')`
  color: ${p => p.theme.tokens.content.secondary};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.md};
  margin: ${p => p.theme.space.md} 0 0;
`;

export const IconWrapper = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${p => p.theme.space.xs};
`;

export const Content = styled('div')`
  margin-top: ${p => p.theme.space.md};
`;
