declare global {
  interface Window {
    SpeechGrammarList: any;
    SpeechRecognition: any;
    SpeechRecognitionEvent: any;

    webkitSpeechGrammarList: any;
    webkitSpeechRecognition: any;
    webkitSpeechRecognitionEvent: any;
  }
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent =
  window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

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
  console.log('Hello!');
}

const phrasePara = document.querySelector('.phrase');
const resultPara = document.querySelector('.result');
const diagnosticPara = document.querySelector('.output');

const btnStart = document.querySelector('button#btn-start');
const btnStop = document.querySelector('button#btn-stop');

let recognition = null;

function startTestSpeech() {
  btnStart.disabled = true;
  btnStart.textContent = 'Test in progress';

  phrase = 'bla';

  phrasePara.textContent = 'bla';
  resultPara.textContent = 'Right or wrong?';
  resultPara.style.background = 'rgba(0,0,0,0.2)';
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
    if (speechResult === phrase) {
      resultPara.textContent = 'I heard the correct phrase!';
      resultPara.style.background = 'lime';
    } else {
      resultPara.textContent = "That didn't sound right.";
      resultPara.style.background = 'red';
    }

    console.log(serializeSpeechRecognitionResultList(event.results));
    // console.log('Confidence: ' + event.results[0][0].confidence);
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

  recognition.onaudiostart = function (event) {
    // Fired when the user agent has started to capture audio.
    console.log('SpeechRecognition.onaudiostart');
  };

  recognition.onaudioend = function (event) {
    // Fired when the user agent has finished capturing audio.
    console.log('SpeechRecognition.onaudioend');
  };

  recognition.onend = function (event) {
    // Fired when the speech recognition service has disconnected.
    console.log('SpeechRecognition.onend');
  };

  recognition.onnomatch = function (event) {
    // Fired when the speech recognition service returns a final result with no significant recognition. This may involve some degree of recognition, which doesn't meet or exceed the confidence threshold.
    console.log('SpeechRecognition.onnomatch');
  };

  recognition.onsoundstart = function (event) {
    // Fired when any sound — recognisable speech or not — has been detected.
    console.log('SpeechRecognition.onsoundstart');
  };

  recognition.onsoundend = function (event) {
    // Fired when any sound — recognisable speech or not — has stopped being detected.
    console.log('SpeechRecognition.onsoundend');
  };

  recognition.onspeechstart = function (event) {
    // Fired when sound that is recognised by the speech recognition service as speech has been detected.
    console.log('SpeechRecognition.onspeechstart');
  };
  recognition.onstart = function (event) {
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
