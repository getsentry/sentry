/* eslint-disable no-console */
import React from 'react';

import {VoiceAssistantButton} from './floatingButton';

export class VoiceAssistantPanel extends React.Component {
  constructor(props) {
    super(props);
    this.state = {isListening: false};
  }

  render() {
    return (
      <div>
        <VoiceAssistantButton />
      </div>
    );
  }
}
