import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {space} from 'sentry/styles/space';

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.tokens.background.primary};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
  min-height: 150px;
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    gap: ${space(1)};
    flex-direction: column;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledBreak = styled('hr')`
  margin: ${space(1)} 0;
  border-color: ${p => p.theme.border};
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
