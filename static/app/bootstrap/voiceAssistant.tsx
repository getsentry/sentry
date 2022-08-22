/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */

// declare global {
//   interface Window {
//     SpeechGrammarList: any;
//     SpeechRecognition: any;
//     SpeechRecognitionEvent: any;

//     webkitSpeechGrammarList: any;
//     webkitSpeechRecognition: any;
//     webkitSpeechRecognitionEvent: any;
//   }
// }

// import SpeechRecognition from 'react-speech-recognition';

// const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
// const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
// const SpeechRecognitionEvent =
//   window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

const grammar = `
#JSGF V1.0;
grammar sentryGrammar;

public <phrase> = <navigationCommand>;

// Navigation commands
<navigationCommand> = go to <pageName> page;
<pageName> = settings | issues | billing | DSN;

// Action commands
// e.g. Select issues, resolve issues, etc.
`;

export function initializeVoiceAssistant() {
  console.log('Initializing Voice Assistant...');
}

const diagnosticPara = document.querySelector('.output');

const btnStart = document.querySelector('button#btn-start') as HTMLButtonElement;
const btnStop = document.querySelector('button#btn-stop') as HTMLButtonElement;

let recognition: SpeechRecognition;

function startTestSpeech() {
  if (!diagnosticPara) {
    return;
  }

  btnStart.disabled = true;
  btnStart.textContent = 'Test in progress';

  diagnosticPara.textContent = '...diagnostic messages';

  recognition = new SpeechRecognition();

  if (!recognition) {
    console.log('Speech recognition not supported');
    return;
  }

  const speechRecognitionList = new SpeechGrammarList();
  speechRecognitionList.addFromString(grammar, 1);
  recognition.grammars = speechRecognitionList;
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 10;

  recognition.start();

  recognition.onresult = function (event) {
    // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
    // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
    // It has a getter so it can be accessed like an array
    // The first [0] returns the SpeechRecognitionResult at position 0.
    // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
    // These also have getters so they can be accessed like arrays.
    // The second [0] returns the SpeechRecognitionAlternative at position 0.
    // We then return the transcript property of the SpeechRecognitionAlternative object
    const speechResult = event.results[0][0].transcript.toLowerCase();
    diagnosticPara.textContent = 'Speech received: ' + speechResult + '.';

    console.log(serializeSpeechRecognitionResultList(event.results));
  };

  recognition.onspeechend = function () {
    recognition.stop();
    btnStart.disabled = false;
    btnStart.textContent = 'Start new test';
  };

  recognition.onerror = function (event) {
    btnStart.disabled = false;
    btnStart.textContent = 'Start new test';
    diagnosticPara.textContent = 'Error occurred in recognition: ' + event.error;
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

function stopTestSpeech() {
  if (recognition) {
    recognition.stop();
  }
  btnStart.disabled = false;
  btnStart.textContent = 'Start new test';
}

if (btnStart) {
  btnStart.addEventListener('click', startTestSpeech);
}
if (btnStop) {
  btnStop.addEventListener('click', stopTestSpeech);
}

// Helpers

function serializeSpeechRecognitionAlternative(obj: SpeechRecognitionAlternative) {
  return `SpeechRecognitionAlternative<transcript: "${obj.transcript}", confidence: ${obj.confidence}>`;
}

function serializeSpeechRecognitionResult(obj: SpeechRecognitionResult) {
  const len = obj.length;
  let res = `SpeechRecognitionResult<length: ${len}, isFinal: ${obj.isFinal}>`;
  for (let index = 0; index < len; index++) {
    const element = obj[index];
    res += `\n    ${serializeSpeechRecognitionAlternative(element)}`;
  }
  return res;
}

function serializeSpeechRecognitionResultList(obj: SpeechRecognitionResultList) {
  const len = obj.length;
  let res = `SpeechRecognitionResultList<length: ${len}>`;
  for (let index = 0; index < len; index++) {
    const element = obj[index];
    res += `\n  ${serializeSpeechRecognitionResult(element)}`;
  }
  return res;
}
