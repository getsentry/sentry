// Helpers

export function speechRecognitionAlternativeToJSON(
  obj: SpeechRecognitionAlternative
): Object {
  return {transcript: obj.transcript, confidence: obj.confidence};
}

export function speechRecognitionResultToJSON(obj: SpeechRecognitionResult): Object {
  const items: Object[] = [];
  for (let index = 0; index < obj.length; index++) {
    const element = obj[index];
    items.push(speechRecognitionAlternativeToJSON(element));
  }
  return {length: obj.length, items, isFinal: obj.isFinal};
}

export function speechRecognitionResultListToJSON(
  obj: SpeechRecognitionResultList
): Object {
  const items: Object[] = [];
  for (let index = 0; index < obj.length; index++) {
    const element = obj[index];
    items.push(speechRecognitionResultToJSON(element));
  }
  return {length: obj.length, items};
}
