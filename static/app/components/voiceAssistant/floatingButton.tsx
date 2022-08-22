// import React from 'react';
import styled from '@emotion/styled';

// interface VoiceAssistantState {
//   isToggleOn: boolean;
// }

// class VoiceAssistantButtonBasic extends React.Component<{}, VoiceAssistantState> {
//   constructor(props) {
//     super(props);
//     this.state = {isToggleOn: true};

//     // This binding is necessary to make `this` work in the callback
//     this.handleClick = this.handleClick.bind(this);
//   }

//   handleClick() {
//     this.setState(prevState => ({
//       isToggleOn: !prevState.isToggleOn,
//     }));
//   }

//   render() {
//     return (
//       <button onClick={this.handleClick}>{this.state.isToggleOn ? 'ON' : 'OFF'}</button>
//     );
//   }
// }

export const VoiceAssistantButton = styled('button')`
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
