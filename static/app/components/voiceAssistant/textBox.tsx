/* eslint-disable no-console */
import React from 'react';
import styled from '@emotion/styled';

interface VoiceAssistantTextboxProps {
  resultText?: string;
  textStyle?: string;
}

const StyledWrapper = styled('div')<VoiceAssistantTextboxProps>`
  position: fixed;
  bottom: 3.3em;
  right: 3.5em;
  width: 350px;
  max-width: 250px;
  height: 50px;
  max-height: 50px;
  background-color: yellow;
  opacity: ${props => (props.resultText ? '1.0' : '0.0')};
`;

export class VoiceAssistantTextbox extends React.Component<
  VoiceAssistantTextboxProps,
  {}
> {
  constructor(props) {
    super(props);
  }

  render() {
    return <StyledWrapper {...this.props}>{this.props.resultText}</StyledWrapper>;
  }
}
