import React from 'react';
import styled from 'react-emotion';

import space from 'app/styles/space';

const SideHeader = styled(function Styled({className, loading, children}) {
  return (
    <h6 className={className}>
      <Title loading={loading}>{children}</Title>
    </h6>
  );
})`
  color: ${p => p.theme.gray3};
  font-weight: bold;
  margin-bottom: ${space(1)};
  text-transform: uppercase;
`;

const Title = styled('span')`
  ${p =>
    p.loading
      ? `
  background-color: ${p.theme.placeholderBackground};
  color: ${p.theme.placeholderBackground};
  `
      : ''};
`;

export default SideHeader;
