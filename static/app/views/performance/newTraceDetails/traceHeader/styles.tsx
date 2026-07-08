import styled from '@emotion/styled';

import {
  Container,
  type ContainerProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

const HeaderLayout = styled((props: ContainerProps) => {
  return (
    <Container
      as="div"
      padding="lg xl"
      borderBottom="primary"
      flexShrink={0}
      {...props}
    />
  );
})``;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${p => p.theme.space.md};
    flex-direction: column;
  }
`;

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
