import styled from '@emotion/styled';

import {
  Container,
  type ContainerProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

function HeaderLayout(props: ContainerProps) {
  return <Container padding="lg xl" borderBottom="primary" flexShrink={0} {...props} />;
}

function HeaderContent(props: StackProps) {
  return <Stack {...props} />;
}

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.radius.md};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const TraceHeaderComponents = {
  HeaderLayout,
  HeaderContent,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
