/* eslint-disable no-console */
import React from 'react';
// eslint-disable-next-line no-restricted-imports
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import {getVoiceActionById, recognitionCommands} from './commands';
import {VoiceAssistantButton} from './floatingButton';
import {getGrammar} from './grammars';
import {VoiceAssistantTextbox} from './textBox';
import {
  getAllRecognitionAlternatives,
  speechRecognitionAlternativeToJSON,
  speechRecognitionResultListToJSON,
} from './utils';
import {parseVoiceCommand} from './voiceAssistParser';

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

export enum NotifyStyle {
  RecognizedResult,
  UnrecognizedResult,
  Error,
  Empty,
}

interface VoiceAssistantState {
  isListening: boolean;
  isTextBoxClosing: boolean;
  notifyStyle: NotifyStyle;
  recognition: SpeechRecognition | undefined;
  speechResult: string;
  textboxVisible: boolean;
}

type VoiceAssistantProps = WithRouterProps & {};

class VoiceAssistantPanel extends React.Component<
  VoiceAssistantProps,
  VoiceAssistantState
> {
  constructor(props) {
    super(props);

    this.state = {
      isListening: false,
      recognition: initializeVoiceAssistant(),
      speechResult: '',
      notifyStyle: NotifyStyle.Empty,
      textboxVisible: false,
      isTextBoxClosing: false,
    };

    // This binding is necessary to make `this` work in the callback
    this.handleToggle = this.handleToggle.bind(this);

    // Hack to access the panel later from other places
    window._voiceAssistantPanel = this;
  }

  getPageParams() {
    const params = this.props.params;
    return {orgId: params.orgId, projectId: params.projectId, groupId: params.groupId};
  }

  hideSpeechResultBox() {
    this.setState(_ => ({
      textboxVisible: false,
    }));
  }

  setIsTextBoxClosing(isClosing: boolean) {
    this.setState(_ => ({
      isTextBoxClosing: isClosing,
    }));
  }

  startVoiceRecognition() {
    this.setIsTextBoxClosing(false);
    const recognition = this.state.recognition;

    const router = this.props.router;
    const params = this.getPageParams();

    if (!recognition) {
      console.log('Speech recognition API is not initialized!');
      return;
    }

    const speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(getGrammar(), 1);
    recognition.grammars = speechRecognitionList;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 10;

    recognition.start();

    const setStateNoListen = () => {
      this.setState(_ => ({
        isListening: false,
      }));
    };

    const setStateSpeechResult = (result: string, style: NotifyStyle) => {
      this.setState(_ => ({
        speechResult: result.toLowerCase(),
        notifyStyle: style,
        textboxVisible: true,
      }));
    };

    const hideSpeechResultBox = () => {
      this.hideSpeechResultBox();
    };

    // FIXME: aaaah this is ugly and wrong
    const isTextBoxClosing = () => {
      return this.state.isTextBoxClosing;
    };
    const setIsTextBoxClosing = (isClosing: boolean) => {
      this.setIsTextBoxClosing(isClosing);
    };

    const setStateSpeechResultWithTimeout = (result: string, style: NotifyStyle) => {
      setStateSpeechResult(result, style);
      const CLOSE_TIMEOUT_MS = 5000;
      setIsTextBoxClosing(true);
      setTimeout(() => {
        if (isTextBoxClosing()) {
          hideSpeechResultBox();
        }
      }, CLOSE_TIMEOUT_MS);
    };

    const getSpeechResult = () => {
      return this.state.speechResult;
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

      console.log(
        JSON.stringify(speechRecognitionResultListToJSON(event.results), null, 2)
      );

      const recognitionAlternatives = getAllRecognitionAlternatives(event.results);

      const [matchResult, matchedAlternative] = parseVoiceCommand(
        recognitionAlternatives,
        recognitionCommands
      );

      if (matchResult && matchedAlternative) {
        setStateSpeechResultWithTimeout(
          matchedAlternative.transcript,
          NotifyStyle.RecognizedResult
        );

        const action = getVoiceActionById(matchResult.id, {
          matchedAlternative,
          router,
          params,
        });
        if (action) {
          console.log(
            `Result: ${JSON.stringify(
              speechRecognitionAlternativeToJSON(matchedAlternative)
            )}`
          );
          action();
        } else {
          console.log('No matched action found!');
          return;
        }
      } else {
        // TODO: Take the alternative with highest confidence
        const bestAlternative = recognitionAlternatives[0];

        setStateSpeechResultWithTimeout(
          `Ooof, not sure what you mean: "${bestAlternative.transcript}"`,
          NotifyStyle.UnrecognizedResult
        );

        console.log('Cannot find a matched alternative');
      }
    };

    recognition.onspeechend = function () {
      console.log('SpeechRecognition.onspeechend');
      recognition.stop();
      setStateNoListen();
    };

    recognition.onerror = function (event) {
      console.log('SpeechRecognition.onerror');
      console.log('Error occurred in recognition: ' + event.error);
      setStateSpeechResultWithTimeout(
        `Error occured in recognition: ${event.error}`,
        NotifyStyle.Error
      );
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
      if (!getSpeechResult()) {
        console.log('Speech recognition: no result received!');
        setStateSpeechResultWithTimeout('No result received!', NotifyStyle.Error);
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
      this.hideSpeechResultBox();
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
      <MainPanel>
        <VoiceAssistantTextbox
          resultText={this.state.speechResult}
          notifyStyle={this.state.notifyStyle}
          textBoxVisible={this.state.textboxVisible}
        />
        <VoiceAssistantButton
          handleToggle={this.handleToggle}
          isListening={this.state.isListening}
        />
      </MainPanel>
    );
  }
}

const MainPanel = styled('div')`
  z-index: 1000;
`;

export default withRouter(VoiceAssistantPanel);
