import styled from '@emotion/styled';

import {Container, type ContainerProps} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';

export function Wrap(props: ContainerProps<'div'>) {
  return <Container marginBottom="3xl" {...props} />;
}

export const Title = styled('h6')`
  color: ${p => p.theme.tokens.content.secondary};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.font.size.md};
  margin: ${space(1)} 0 0;
`;

export const IconWrapper = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  margin-left: ${space(0.5)};
`;

export function Content(props: ContainerProps<'div'>) {
  return <Container marginTop="md" {...props} />;
}
