/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

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

let recognition: SpeechRecognition;

export function initializeVoiceAssistant() {
  if (!SpeechRecognition) {
    console.log('Speech recognition not supported');
    return;
  }
  console.log('Initializing Voice Assistant...');
  recognition = new SpeechRecognition();
  if (!recognition) {
    console.log('Speech recognition API could not be initialized');
    return;
  }
}

export function startVoiceRecognition(finalizeCallback: CallableFunction) {
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

  recognition.onresult = function (event: SpeechRecognitionEvent) {
    // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
    // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
    // It has a getter so it can be accessed like an array
    // The first [0] returns the SpeechRecognitionResult at position 0.
    // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
    // These also have getters so they can be accessed like arrays.
    // The second [0] returns the SpeechRecognitionAlternative at position 0.
    // We then return the transcript property of the SpeechRecognitionAlternative object
    speechResult = event.results[0][0].transcript.toLowerCase();
    console.log(`Phrase recognized: "${speechResult}"`);

    console.log(
      JSON.stringify(speechRecognitionResultListToJSON(event.results), null, 2)
    );
  };

  recognition.onspeechend = function () {
    console.log('SpeechRecognition.onspeechend');
    recognition.stop();
    finalizeCallback();
  };

  recognition.onerror = function (event) {
    console.log('SpeechRecognition.onerror');
    console.log('Error occurred in recognition: ' + event.error);
    finalizeCallback();
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

export function stopVoiceRecognition() {
  if (recognition) {
    recognition.stop();
  }
}

// Helpers

function speechRecognitionAlternativeToJSON(obj: SpeechRecognitionAlternative): Object {
  return {transcript: obj.transcript, confidence: obj.confidence};
}

function speechRecognitionResultToJSON(obj: SpeechRecognitionResult): Object {
  const items: Object[] = [];
  for (let index = 0; index < obj.length; index++) {
    const element = obj[index];
    items.push(speechRecognitionAlternativeToJSON(element));
  }
  return {length: obj.length, items, isFinal: obj.isFinal};
}

function speechRecognitionResultListToJSON(obj: SpeechRecognitionResultList): Object {
  const items: Object[] = [];
  for (let index = 0; index < obj.length; index++) {
    const element = obj[index];
    items.push(speechRecognitionResultToJSON(element));
  }
  return {length: obj.length, items};
}
