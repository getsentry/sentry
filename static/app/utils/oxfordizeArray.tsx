// Given a list of strings (probably nouns), join them into a single string
// with correct punctuation and 'and' placement
//
// for example: ['A'] --> 'A'
//              ['A', 'B'] --> 'A and B'
//              ['A', 'B', 'C'] --> 'A, B, and C'
const oxfordizeArray = (strings: string[]) =>
  strings.length <= 2
    ? strings.join(' and ')
    : [strings.slice(0, -1).join(', '), strings.slice(-1)[0]].join(', and ');

export default oxfordizeArray;
