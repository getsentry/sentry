import styled from '@emotion/styled';

import {Stack, type StackProps} from '@sentry/scraps/layout';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  min-height: 150px;
`;

function HeaderRow(props: StackProps<'div'>) {
  return <Stack justify="between" align="center" gap="xl" {...props} />;
}

function HeaderContent(props: StackProps<'div'>) {
  return <Stack {...props} />;
}

const StyledBreak = styled('hr')`
  margin: ${space(1)} 0;
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
