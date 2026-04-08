import styled from '@emotion/styled';

import {
  Container,
  type ContainerProps,
  Stack,
  type StackProps,
} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

const HeaderLayout = styled((props: ContainerProps<'div'>) => {
  const hasPageFrame = useHasPageFrameFeature();
  return (
    <Container
      as="div"
      padding={hasPageFrame ? 'lg xl' : 'md 2xl'}
      background={hasPageFrame ? undefined : 'primary'}
      borderBottom="primary"
      flexShrink={0}
      minHeight="150px"
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

function HeaderContent(props: StackProps<'div'>) {
  return <Stack {...props} />;
}

const StyledBreak = styled('hr')`
  margin: ${p => p.theme.space.md} 0;
  border-color: ${p => p.theme.tokens.border.primary};
`;

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.radius.md};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const TraceHeaderComponents = {
  HeaderLayout,
  HeaderRow,
  HeaderContent,
  StyledBreak,
  StyledPlaceholder,
};

export {TraceHeaderComponents};
