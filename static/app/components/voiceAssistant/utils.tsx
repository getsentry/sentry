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

export function getAllRecognitionAlternatives(
  resultList: SpeechRecognitionResultList
): SpeechRecognitionAlternative[] {
  const res: SpeechRecognitionAlternative[] = [];
  for (let i = 0; i < resultList.length; i++) {
    const result = resultList[i];
    for (let j = 0; j < result.length; j++) {
      res.push(result[j]);
    }
  }
  return res;
}
