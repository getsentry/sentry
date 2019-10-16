import styled from 'react-emotion';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';

export const QueryLink = styled(Link)`
  ${overflowEllipsis};
  color: ${p => p.theme.foreground};
  border-radius: ${p => p.theme.borderRadius};
  &:hover {
    color: ${p => p.theme.foreground};
    background-color: ${p => p.theme.offWhite};
  }
`;
