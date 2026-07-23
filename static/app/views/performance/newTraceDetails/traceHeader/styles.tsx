import styled from '@emotion/styled';

import {
  Container,
  type ContainerProps,
  Flex,
  type FlexProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

function HeaderLayout(props: ContainerProps) {
  return <Container padding="lg xl" borderBottom="primary" flexShrink={0} {...props} />;
}

function HeaderRow(props: FlexProps) {
  return (
    <Flex
      justify="between"
      align="center"
      direction={{zero: 'column', xl: 'row'}}
      gap={{zero: 'md', xl: 'xl'}}
      {...props}
    />
  );
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
  HeaderRow,
  HeaderContent,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
