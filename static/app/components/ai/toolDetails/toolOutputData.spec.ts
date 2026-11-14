import {parseToolOutput} from './toolOutputData';

it('preserves malformed JSON as text', () => {
  expect(parseToolOutput('{invalid json')).toEqual({
    kind: 'text',
    value: '{invalid json',
  });
});

it('does not reinterpret JSON inside a string result', () => {
  const text = '{"answer":20}';
  expect(parseToolOutput(JSON.stringify(text))).toEqual({kind: 'text', value: text});
});

it('accepts parsed structured values', () => {
  expect(parseToolOutput({answer: 20})).toEqual({kind: 'object', value: {answer: 20}});
  expect(parseToolOutput([20])).toEqual({kind: 'array', value: [20]});
});
