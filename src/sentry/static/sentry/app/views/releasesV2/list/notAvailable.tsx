import React from 'react';
import styled from '@emotion/styled';

const NotAvailable = () => {
  return <Wrapper>{'\u2014'}</Wrapper>;
};

const Wrapper = styled('div')`
  color: ${p => p.theme.gray1};
`;

export default NotAvailable;
