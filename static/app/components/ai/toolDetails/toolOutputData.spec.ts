import {parseToolOutput} from './toolOutputData';

it.each([
  [undefined, {kind: 'missing', value: undefined}],
  ['null', {kind: 'null', value: null}],
  ['[]', {kind: 'array', value: []}],
  ['{"answer":20}', {kind: 'object', value: {answer: 20}}],
  ['"done"', {kind: 'text', value: 'done'}],
  ['false', {kind: 'boolean', value: false}],
  ['0', {kind: 'number', value: 0}],
  ['', {kind: 'text', value: ''}],
  ['plain text', {kind: 'text', value: 'plain text'}],
  ['{invalid json', {kind: 'text', value: '{invalid json'}],
])('parses %p into a typed tool output', (value, expected) => {
  expect(parseToolOutput(value)).toEqual(expected);
});

it('does not reinterpret JSON inside a string result', () => {
  const text = '{"answer":20}';
  expect(parseToolOutput(JSON.stringify(text))).toEqual({kind: 'text', value: text});
});

it('accepts parsed structured values', () => {
  expect(parseToolOutput({answer: 20})).toEqual({kind: 'object', value: {answer: 20}});
  expect(parseToolOutput([20])).toEqual({kind: 'array', value: [20]});
});
