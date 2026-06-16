import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

export function Wrap(props: ContainerProps) {
  return <Container marginBottom="3xl" {...props} />;
}

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

export function Content(props: ContainerProps) {
  return <Container marginTop="md" {...props} />;
}
