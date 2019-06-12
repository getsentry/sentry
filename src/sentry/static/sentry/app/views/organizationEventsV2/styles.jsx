import styled from 'react-emotion';
import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';

export const QueryLink = styled(Link)`
  ${overflowEllipsis};
  color: ${p => p.theme.foreground};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  &:hover {
    color: ${p => p.theme.foreground};
    background-color: ${p => p.theme.offWhite};
  }
`;
