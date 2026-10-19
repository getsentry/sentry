import {getCodeModeInput, isCodeModeNode} from './codeMode';
import type {AITraceSpanNode} from './types';

function toolNode(name: string): AITraceSpanNode {
  return {attributes: {'gen_ai.tool.name': name}} as unknown as AITraceSpanNode;
}

describe('isCodeModeNode', () => {
  it('recognizes execution tools, not search or ordinary tools', () => {
    expect(isCodeModeNode(toolNode('sentry_api_execute'))).toBe(true);
    expect(isCodeModeNode(toolNode('execute_code'))).toBe(true);
    expect(isCodeModeNode(toolNode('sentry_api_search'))).toBe(false);
    expect(isCodeModeNode(toolNode('search_issues'))).toBe(false);
  });
});

describe('getCodeModeInput', () => {
  it('extracts source from JSON without changing it', () => {
    const code = 'const result=await api.search({limit:5});\nreturn result;';
    expect(getCodeModeInput(JSON.stringify({code}))).toEqual({
      code,
      language: 'javascript',
    });
  });

  it('supports script arguments and explicit languages', () => {
    expect(getCodeModeInput({script: 'print(1)', language: 'py'})).toEqual({
      code: 'print(1)',
      language: 'python',
    });
  });

  it('preserves raw and incomplete code', () => {
    const code = ' async function run() {';
    expect(getCodeModeInput(code)).toEqual({code, language: 'javascript'});
    expect(getCodeModeInput(JSON.stringify('return 42;'))).toEqual({
      code: 'return 42;',
      language: 'javascript',
    });
  });

  it.each([
    undefined,
    null,
    '',
    '  ',
    '{}',
    '[]',
    'false',
    '42',
    {code: 123},
    {query: 'search'},
  ])('does not invent code for %p', input => {
    expect(getCodeModeInput(input)).toBeNull();
  });
});
