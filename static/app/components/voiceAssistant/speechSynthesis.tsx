export function speakPhrase(phrase: string) {
  const synth = window.speechSynthesis;
  const utterThis = new SpeechSynthesisUtterance(phrase);
  utterThis.lang = 'en-US';
  // utterThis.voice = '';
  // Value between 0.0 and 2.0; the default is 1.0
  utterThis.pitch = 1.0;
  // Value between 0.1 and 10.0; the default is 1.0
  utterThis.rate = 1.0;
  synth.speak(utterThis);
}
