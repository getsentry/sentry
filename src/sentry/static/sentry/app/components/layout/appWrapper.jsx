import React from 'react';
import styled from 'react-emotion';

import backgroundPattern from '../../../images/sentry-pattern.png';

const AppWrapper = ({children}) => (
  <Wrapper>
    <PatternBackground />
    <Container className="container">{children}</Container>
  </Wrapper>
);

const PatternBackground = styled('div')`
  background: #f2f1f3 url(${backgroundPattern});
  background-size: 340px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: -1;
  opacity: 0.4;
`;

// TODO(epurkhiser): The container styles have some relativey complex selector
// inheritence that will need to be handled, probably with some props.
const Container = styled('div')``;

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
`;

export default AppWrapper;
