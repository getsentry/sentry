import React from 'react';
import styled from '@emotion/styled';

function NotAvailable() {
  return <Wrapper>{'\u2014'}</Wrapper>;
}

// TODO(PRISCILA): make this a common component
const Wrapper = styled('div')`
  color: ${p => p.theme.gray200};
`;

export default NotAvailable;
