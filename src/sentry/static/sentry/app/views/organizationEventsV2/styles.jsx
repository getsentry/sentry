import React from 'react';
import styled from 'react-emotion';
import space from 'app/styles/space';
import Button from 'app/components/button';
import overflowEllipsis from 'app/styles/overflowEllipsis';

export const QueryButton = styled(props => (
  <Button size="zero" borderless={true} {...props} />
))`
  ${overflowEllipsis};
  color: ${p => p.theme.foreground};
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  &:hover {
    color: ${p => p.theme.foreground};
    background-color: ${p => p.theme.offWhite};
  }
`;
