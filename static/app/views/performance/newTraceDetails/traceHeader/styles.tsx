import styled from '@emotion/styled';

import {Stack, type StackProps} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space['2xl']} ${p => p.theme.space.md}
    ${p => p.theme.space['2xl']};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  flex-shrink: 0;
  min-height: 150px;
`;

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
