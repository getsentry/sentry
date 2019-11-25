import styled from 'react-emotion';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import Link from 'app/components/links/link';
import space from 'app/styles/space';

export const QueryLink = styled(Link)`
  ${overflowEllipsis};
`;

export const SectionHeading = styled('h4')`
  color: ${p => p.theme.gray3};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0;
`;
