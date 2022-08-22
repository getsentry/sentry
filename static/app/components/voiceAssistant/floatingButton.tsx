/* eslint-disable no-alert */
import React from 'react';
import {css, keyframes} from '@emotion/react';
// import {css} from '@emotion/react';
import styled from '@emotion/styled';

// import {
//   startVoiceRecognition,
//   stopVoiceRecognition,
// } from 'sentry/bootstrap/voiceAssistant';

interface VoiceAssistantState {
  isToggleOn: boolean;
}

interface VoiceButtonProps {
  active: boolean;
}

const Wrapper = styled('div')`
  position: fixed;
  bottom: 3em;
  right: 3em;
`;

const Logo = styled('svg')`
  opacity: 0.5;
  transition: opacity 0.3s ease-in-out;
`;

const ripple1 = keyframes`
  0% {
    transform:scale(1);
  }
  20% {
    transform:scale(2);
    opacity: 0.1;
  }
  50% {
    transform:scale(1.5);
    opacity: 0.25;
  }
  70% {
    transform:scale(2);
    opacity: 0.1;
  }
  100% {
    transform:scale(1);
  }
`;

const ripple2 = keyframes`
  0% {
    transform:scale(1);
  }
  20% {
    transform:scale(3);
    opacity: 0.1;
  }
  50% {
    transform:scale(2);
    opacity: 0.2;
  }
  70% {
    transform:scale(3);
    opacity: 0.1;
  }
  100% {
    transform:scale(1);
  }
`;

const Ripple1 = styled('div')``;
const Ripple2 = styled('div')``;

const VoiceButton = styled('button')<VoiceButtonProps>`
  position: relative;
  display: block;
  height: 4em;
  width: 4em;
  border-radius: 50%;
  background-color: white;
  border: none;
  cursor: pointer;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0);
  transition: box-shadow 0.3s ease-in-out;

  &:hover {
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);

    > ${Logo} {
      opacity: 1;
    }
  }

  &::before {
    display: block;
    position: absolute;
    content: ' ';
    width: 120%;
    height: 120%;
    left: -10%;
    top: -10%;
    border-radius: 50%;
    background-color: ${props => (props.active ? '#584AC0' : '#eee')};
    z-index: -1;
    transition: background-color 0.3s ease-in-out;
  }

  ${props =>
    props.active &&
    css`
      > ${Ripple1} {
        z-index: -1;
        position: absolute;
        width: 100%;
        height: 100%;
        left: 50%;
        top: 50%;
        translate: -50% -50%;
        border-radius: 50%;
        background: #584ac0;
        opacity: 0.5;
        animation: ${ripple1} 2s infinite;
      }

      > ${Ripple2} {
        z-index: -2;
        position: absolute;
        width: 100%;
        height: 100%;
        left: 50%;
        top: 50%;
        translate: -50% -50%;
        border-radius: 50%;
        background: #584ac0;
        opacity: 0.3;
        animation: ${ripple2} 2s infinite;
      }
    `}
`;

export class VoiceAssistantButton extends React.Component<{}, VoiceAssistantState> {
  constructor(props) {
    super(props);
    this.state = {isToggleOn: false};

    // This binding is necessary to make `this` work in the callback
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick() {
    // if (!this.state.isToggleOn) {
    //   startVoiceRecognition();
    // } else {
    //   stopVoiceRecognition();
    // }

    this.setState(prevState => ({
      isToggleOn: !prevState.isToggleOn,
    }));
  }

  render() {
    return (
      <Wrapper>
        <VoiceButton active={this.state.isToggleOn} onClick={this.handleClick}>
          {/* {this.state.isToggleOn ? 'ACTIVATED' : 'Waiting...'} */}
          <Ripple1 />
          <Ripple2 />
          <Logo
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 72 66"
            width="3em"
            height="3em"
          >
            <path
              d="M29,2.26a4.67,4.67,0,0,0-8,0L14.42,13.53A32.21,32.21,0,0,1,32.17,40.19H27.55A27.68,27.68,0,0,0,12.09,17.47L6,28a15.92,15.92,0,0,1,9.23,12.17H4.62A.76.76,0,0,1,4,39.06l2.94-5a10.74,10.74,0,0,0-3.36-1.9l-2.91,5a4.54,4.54,0,0,0,1.69,6.24A4.66,4.66,0,0,0,4.62,44H19.15a19.4,19.4,0,0,0-8-17.31l2.31-4A23.87,23.87,0,0,1,23.76,44H36.07a35.88,35.88,0,0,0-16.41-31.8l4.67-8a.77.77,0,0,1,1.05-.27c.53.29,20.29,34.77,20.66,35.17a.76.76,0,0,1-.68,1.13H40.6q.09,1.91,0,3.81h4.78A4.59,4.59,0,0,0,50,39.43a4.49,4.49,0,0,0-.62-2.28Z"
              transform="translate(11, 11)"
              fill="#362d59"
            />
          </Logo>
        </VoiceButton>
      </Wrapper>
    );
  }
}
