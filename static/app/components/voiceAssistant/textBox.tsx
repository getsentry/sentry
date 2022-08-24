/* eslint-disable no-console */
import React from 'react';
import styled from '@emotion/styled';

import {NotifyStyle} from './voicePanel';

interface VoiceAssistantTextboxProps {
  resultText?: string;
  textStyle?: NotifyStyle;
}

const StyledWrapper = styled('div')<VoiceAssistantTextboxProps>`
  position: fixed;
  bottom: 3.3em;
  right: 3.5em;
  height: 50px;
  max-height: 50px;
  padding: 1em;
  padding-right: 5em;
  opacity: ${props => (props.resultText ? '1.0' : '0.0')};
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid;

  ${props =>
    props.textStyle === NotifyStyle.Error
      ? `border-color: rgba(245, 84, 89, 0.5);
         background: rgba(245, 84, 89, 0.09);`
      : `border-color: rgba(60, 116, 221, 0.5);
         background: rgba(60, 116, 221, 0.15);`}
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
