import styled from 'react-emotion';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

export const QueryLink = styled('a')`
  ${overflowEllipsis};
  color: ${p => p.theme.foreground};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  &:hover {
    color: ${p => p.theme.foreground};
    background-color: ${p => p.theme.offWhite};
  }
`;
