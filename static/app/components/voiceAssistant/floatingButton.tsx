import React from 'react';
import {css} from '@emotion/react';

interface VoiceAssistantState {
  isToggleOn: boolean;
}

const buttonCss = css`
  display: block;
  position: fixed;
  bottom: 5%;
  right: 5%;
  border-radius: 50%;
  font-size: 0.875rem;
  font-weight: 600;
  color: red;
  z-index: 2000;
`;

export class VoiceAssistantButton extends React.Component<{}, VoiceAssistantState> {
  constructor(props) {
    super(props);
    this.state = {isToggleOn: true};

    // This binding is necessary to make `this` work in the callback
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    this.setState(prevState => ({
      isToggleOn: !prevState.isToggleOn,
    }));
  }

  render() {
    return (
      <button css={buttonCss} onClick={this.handleClick}>
        {this.state.isToggleOn ? 'ON' : 'OFF'}
      </button>
    );
  }
}
