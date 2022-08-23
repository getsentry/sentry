/* eslint-disable no-console */
import React from 'react';

import {VoiceAssistantButton} from './floatingButton';
import {grammar} from './grammars';
import {speechRecognitionResultListToJSON} from './utils';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

declare global {
  interface Window {
    _voiceAssistantPanel: VoiceAssistantPanel;
  }
}

export function initializeVoiceAssistant(): SpeechRecognition | undefined {
  if (!SpeechRecognition) {
    console.log('Speech recognition not supported');
    return undefined;
  }
  console.log('Initializing Voice Assistant...');
  const recognition = new SpeechRecognition();
  if (!recognition) {
    console.log('Speech recognition API could not be initialized');
    return undefined;
  }
  return recognition;
}

interface VoiceAssistantState {
  isListening: boolean;
  recognition: SpeechRecognition | undefined;
}

export class VoiceAssistantPanel extends React.Component<{}, VoiceAssistantState> {
  constructor(props) {
    super(props);

    this.state = {
      isListening: false,
      recognition: initializeVoiceAssistant(),
    };

    // This binding is necessary to make `this` work in the callback
    this.handleToggle = this.handleToggle.bind(this);

    // Hack to access the panel later from other places
    window._voiceAssistantPanel = this;
  }

  startVoiceRecognition() {
    const recognition = this.state.recognition;

    if (!recognition) {
      console.log('Speech recognition API is not initialized!');
      return;
    }

    const speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 10;

    recognition.start();
    let speechResult = '';

    const setStateNoListen = () => {
      this.setState(_ => ({
        isListening: false,
      }));
    };

    recognition.onresult = function (event: SpeechRecognitionEvent) {
      // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
      // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
      // It has a getter so it can be accessed like an array
      // The first [0] returns the SpeechRecognitionResult at position 0.
      // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
      // These also have getters so they can be accessed like arrays.
      // The second [0] returns the SpeechRecognitionAlternative at position 0.
      // We then return the transcript property of the SpeechRecognitionAlternative object
      console.log('SpeechRecognition.onresult');
      speechResult = event.results[0][0].transcript.toLowerCase();
      console.log(`Phrase recognized: "${speechResult}"`);

      console.log(
        JSON.stringify(speechRecognitionResultListToJSON(event.results), null, 2)
      );
    };

    recognition.onspeechend = function () {
      console.log('SpeechRecognition.onspeechend');
      recognition.stop();
      setStateNoListen();
    };

    recognition.onerror = function (event) {
      console.log('SpeechRecognition.onerror');
      console.log('Error occurred in recognition: ' + event.error);
      setStateNoListen();
    };

    recognition.onaudiostart = function (_) {
      // Fired when the user agent has started to capture audio.
      console.log('SpeechRecognition.onaudiostart');
    };

    recognition.onaudioend = function (_) {
      // Fired when the user agent has finished capturing audio.
      console.log('SpeechRecognition.onaudioend');
    };

    recognition.onend = function (_) {
      // Fired when the speech recognition service has disconnected.
      console.log('SpeechRecognition.onend');
      if (!speechResult) {
        console.log('No result received!');
      }
    };

    recognition.onnomatch = function (_) {
      // Fired when the speech recognition service returns a final result with no significant recognition. This may involve some degree of recognition, which doesn't meet or exceed the confidence threshold.
      console.log('SpeechRecognition.onnomatch');
    };

    recognition.onsoundstart = function (_) {
      // Fired when any sound — recognisable speech or not — has been detected.
      console.log('SpeechRecognition.onsoundstart');
    };

    recognition.onsoundend = function (_) {
      // Fired when any sound — recognisable speech or not — has stopped being detected.
      console.log('SpeechRecognition.onsoundend');
    };

    recognition.onspeechstart = function (_) {
      // Fired when sound that is recognised by the speech recognition service as speech has been detected.
      console.log('SpeechRecognition.onspeechstart');
    };
    recognition.onstart = function (_) {
      // Fired when the speech recognition service has begun listening to incoming audio with intent to recognize grammars associated with the current SpeechRecognition.
      console.log('SpeechRecognition.onstart');
    };
  }

  stopVoiceRecognition() {
    if (this.state.recognition) {
      this.state.recognition.stop();
    }
  }

  handleToggle() {
    if (!this.state.isListening) {
      console.log('>>> Starting speech recognition...');
      this.startVoiceRecognition();
    } else {
      console.log('>>> Terminating speech recognition...');
      this.stopVoiceRecognition();
    }

    this.setState(prevState => ({
      isListening: !prevState.isListening,
    }));
  }

  render() {
    return (
      <div>
        <VoiceAssistantButton
          handleToggle={this.handleToggle}
          isListening={this.state.isListening}
        />
      </div>
    );
  }
}
