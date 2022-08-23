/* eslint-disable no-console */
import React from 'react';
import styled from '@emotion/styled';

const StyledWrapper = styled('div')`
  position: fixed;
  bottom: 3.3em;
  right: 3.5em;
  width: 350px;
  max-width: 250px;
  height: 50px;
  max-height: 50px;
  background-color: yellow;
  opacity: 0;
`;

export class VoiceAssistantTextbox extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return <StyledWrapper />;
  }
}
