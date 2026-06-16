import {extractJsonFromText, findMatchingBracket} from './extractJsonFromText';

describe('findMatchingBracket', () => {
  it('finds matching curly brace', () => {
    expect(findMatchingBracket('{}', 0)).toBe(1);
  });

  it('finds matching square bracket', () => {
    expect(findMatchingBracket('[]', 0)).toBe(1);
  });

  it('handles nested braces', () => {
    expect(findMatchingBracket('{{{}}}', 0)).toBe(5);
  });

  it('handles mixed bracket types', () => {
    expect(findMatchingBracket('{[{}]}', 0)).toBe(5);
  });

  it('returns -1 for unmatched opening brace', () => {
    expect(findMatchingBracket('{', 0)).toBe(-1);
  });

  it('returns -1 for unmatched opening bracket', () => {
    expect(findMatchingBracket('[', 0)).toBe(-1);
  });

  it('starts from the given position', () => {
    expect(findMatchingBracket('xx{yy}zz', 2)).toBe(5);
  });

  it('ignores braces inside double-quoted strings', () => {
    expect(findMatchingBracket('{"key": "}"}', 0)).toBe(11);
  });

  it('ignores brackets inside double-quoted strings', () => {
    expect(findMatchingBracket('{"key": "]"}', 0)).toBe(11);
  });

  it('handles escaped quotes inside strings', () => {
    expect(findMatchingBracket('{"key": "val\\"ue"}', 0)).toBe(17);
  });

  it('handles escaped backslash before closing quote', () => {
    // The value is a string ending with a literal backslash: "val\\"
    // In the JSON: {"k": "val\\"}  — the \\\\ is an escaped backslash,
    // so the quote after it closes the string.
    expect(findMatchingBracket('{"k": "val\\\\"}', 0)).toBe(13);
  });

  it('handles multiple escaped characters in a string', () => {
    expect(findMatchingBracket('{"k": "a\\nb\\tc"}', 0)).toBe(15);
  });

  it('handles empty object', () => {
    expect(findMatchingBracket('{}', 0)).toBe(1);
  });

  it('handles empty array', () => {
    expect(findMatchingBracket('[]', 0)).toBe(1);
  });

  it('handles deeply nested structure', () => {
    expect(findMatchingBracket('[[[[[]]]]]', 0)).toBe(9);
  });

  it('handles string containing opening braces', () => {
    expect(findMatchingBracket('{"braces": "{{{"}', 0)).toBe(16);
  });

  it('handles string containing brackets and braces mixed', () => {
    expect(findMatchingBracket('{"val": "[{]"}', 0)).toBe(13);
  });

  it('returns -1 when string has unbalanced quotes disrupting matching', () => {
    // An unclosed string means the closing brace is "inside" the string
    expect(findMatchingBracket('{"key: }', 0)).toBe(-1);
  });
});

describe('extractJsonFromText', () => {
  describe('basic extraction', () => {
    it('returns empty array for empty string', () => {
      expect(extractJsonFromText('')).toEqual([]);
    });

    it('returns a single text segment for plain text', () => {
      expect(extractJsonFromText('hello world')).toEqual([
        {type: 'text', value: 'hello world'},
      ]);
    });

    it('extracts a standalone JSON object', () => {
      expect(extractJsonFromText('{"key": "value"}')).toEqual([
        {type: 'json', value: '{"key": "value"}'},
      ]);
    });

    it('extracts a standalone JSON array', () => {
      expect(extractJsonFromText('[1, 2, 3]')).toEqual([
        {type: 'json', value: '[1, 2, 3]'},
      ]);
    });

    it('extracts JSON object with surrounding text', () => {
      expect(extractJsonFromText('prefix {"key": "value"} suffix')).toEqual([
        {type: 'text', value: 'prefix '},
        {type: 'json', value: '{"key": "value"}'},
        {type: 'text', value: ' suffix'},
      ]);
    });

    it('extracts JSON array with surrounding text', () => {
      expect(extractJsonFromText('data: [1, 2, 3] end')).toEqual([
        {type: 'text', value: 'data: '},
        {type: 'json', value: '[1, 2, 3]'},
        {type: 'text', value: ' end'},
      ]);
    });

    it('extracts JSON at the very start', () => {
      expect(extractJsonFromText('{"key": "value"} trailing')).toEqual([
        {type: 'json', value: '{"key": "value"}'},
        {type: 'text', value: ' trailing'},
      ]);
    });

    it('extracts JSON at the very end', () => {
      expect(extractJsonFromText('leading {"key": "value"}')).toEqual([
        {type: 'text', value: 'leading '},
        {type: 'json', value: '{"key": "value"}'},
      ]);
    });
  });

  describe('multiple JSON values', () => {
    it('extracts multiple JSON objects', () => {
      expect(extractJsonFromText('a {"x": 1} b {"y": 2} c')).toEqual([
        {type: 'text', value: 'a '},
        {type: 'json', value: '{"x": 1}'},
        {type: 'text', value: ' b '},
        {type: 'json', value: '{"y": 2}'},
        {type: 'text', value: ' c'},
      ]);
    });

    it('extracts adjacent JSON objects without separator', () => {
      expect(extractJsonFromText('{"a": 1}{"b": 2}')).toEqual([
        {type: 'json', value: '{"a": 1}'},
        {type: 'json', value: '{"b": 2}'},
      ]);
    });

    it('extracts mixed objects and arrays', () => {
      expect(extractJsonFromText('obj: {"a": 1} arr: [2, 3]')).toEqual([
        {type: 'text', value: 'obj: '},
        {type: 'json', value: '{"a": 1}'},
        {type: 'text', value: ' arr: '},
        {type: 'json', value: '[2, 3]'},
      ]);
    });
  });

  describe('nested structures', () => {
    it('handles nested objects', () => {
      expect(extractJsonFromText('r: {"a": {"b": {"c": 1}}}')).toEqual([
        {type: 'text', value: 'r: '},
        {type: 'json', value: '{"a": {"b": {"c": 1}}}'},
      ]);
    });

    it('handles nested arrays', () => {
      expect(extractJsonFromText('r: [[1, [2]], [3]]')).toEqual([
        {type: 'text', value: 'r: '},
        {type: 'json', value: '[[1, [2]], [3]]'},
      ]);
    });

    it('handles objects containing arrays', () => {
      expect(extractJsonFromText('r: {"a": [1, 2, 3]}')).toEqual([
        {type: 'text', value: 'r: '},
        {type: 'json', value: '{"a": [1, 2, 3]}'},
      ]);
    });

    it('handles arrays containing objects', () => {
      expect(extractJsonFromText('r: [{"a": 1}, {"b": 2}]')).toEqual([
        {type: 'text', value: 'r: '},
        {type: 'json', value: '[{"a": 1}, {"b": 2}]'},
      ]);
    });
  });

  describe('string literal handling (where naive packages fail)', () => {
    it('handles braces inside JSON string values', () => {
      expect(extractJsonFromText('log: {"pattern": "{user}"}')).toEqual([
        {type: 'text', value: 'log: '},
        {type: 'json', value: '{"pattern": "{user}"}'},
      ]);
    });

    it('handles brackets inside JSON string values', () => {
      expect(extractJsonFromText('log: {"pattern": "[item]"}')).toEqual([
        {type: 'text', value: 'log: '},
        {type: 'json', value: '{"pattern": "[item]"}'},
      ]);
    });

    it('handles closing brace inside a string value', () => {
      // This is the case that breaks balanced-match and extract-json-from-string
      expect(extractJsonFromText('x {"key": "}"} y')).toEqual([
        {type: 'text', value: 'x '},
        {type: 'json', value: '{"key": "}"}'},
        {type: 'text', value: ' y'},
      ]);
    });

    it('handles closing bracket inside a string value', () => {
      expect(extractJsonFromText('x {"key": "]"} y')).toEqual([
        {type: 'text', value: 'x '},
        {type: 'json', value: '{"key": "]"}'},
        {type: 'text', value: ' y'},
      ]);
    });

    it('handles escaped quotes in string values', () => {
      expect(extractJsonFromText('d: {"msg": "say \\"hello\\""}')).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: '{"msg": "say \\"hello\\""}'},
      ]);
    });

    it('handles escaped backslash before closing quote', () => {
      // Value is literally: val\  (backslash at end)
      // JSON encoding: "val\\"  — the \\\\ is an escaped backslash
      expect(extractJsonFromText('d: {"k": "val\\\\"}')).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: '{"k": "val\\\\"}'},
      ]);
    });

    it('handles newlines and tabs in JSON strings', () => {
      expect(extractJsonFromText('d: {"k": "line1\\nline2"}')).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: '{"k": "line1\\nline2"}'},
      ]);
    });

    it('handles unicode escapes in JSON strings', () => {
      expect(extractJsonFromText('d: {"k": "caf\\u00e9"}')).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: '{"k": "caf\\u00e9"}'},
      ]);
    });
  });

  describe('non-JSON braces treated as text', () => {
    it('treats template-style braces as text', () => {
      expect(extractJsonFromText('hello {name} world')).toEqual([
        {type: 'text', value: 'hello {name} world'},
      ]);
    });

    it('treats unmatched opening brace as text', () => {
      expect(extractJsonFromText('not {json')).toEqual([
        {type: 'text', value: 'not {json'},
      ]);
    });

    it('treats unmatched opening bracket as text', () => {
      expect(extractJsonFromText('not [json')).toEqual([
        {type: 'text', value: 'not [json'},
      ]);
    });

    it('treats matched but syntactically invalid JSON as text', () => {
      expect(extractJsonFromText('{invalid json content}')).toEqual([
        {type: 'text', value: '{invalid json content}'},
      ]);
    });

    it('treats Python-style dicts as text', () => {
      expect(extractJsonFromText("data: {'key': 'value'}")).toEqual([
        {type: 'text', value: "data: {'key': 'value'}"},
      ]);
    });

    it('treats braces in code snippets as text', () => {
      expect(extractJsonFromText('function() { return 1; }')).toEqual([
        {type: 'text', value: 'function() { return 1; }'},
      ]);
    });

    it('treats CSS-like braces as text', () => {
      expect(extractJsonFromText('.class { color: red; }')).toEqual([
        {type: 'text', value: '.class { color: red; }'},
      ]);
    });

    it('treats multiple template vars as text', () => {
      expect(extractJsonFromText('{user} logged in from {ip}')).toEqual([
        {type: 'text', value: '{user} logged in from {ip}'},
      ]);
    });
  });

  describe('JSON value types', () => {
    it('does not treat bare primitives as JSON segments', () => {
      expect(extractJsonFromText('value: 123')).toEqual([
        {type: 'text', value: 'value: 123'},
      ]);
    });

    it('extracts arrays of primitives', () => {
      expect(extractJsonFromText('[true, false, null]')).toEqual([
        {type: 'json', value: '[true, false, null]'},
      ]);
    });

    it('extracts objects with various value types', () => {
      const json = '{"s": "str", "n": 42, "b": true, "x": null}';
      expect(extractJsonFromText(`d: ${json}`)).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: json},
      ]);
    });

    it('extracts empty object', () => {
      expect(extractJsonFromText('empty: {}')).toEqual([
        {type: 'text', value: 'empty: '},
        {type: 'json', value: '{}'},
      ]);
    });

    it('extracts empty array', () => {
      expect(extractJsonFromText('empty: []')).toEqual([
        {type: 'text', value: 'empty: '},
        {type: 'json', value: '[]'},
      ]);
    });

    it('extracts array of strings', () => {
      expect(extractJsonFromText('tags: ["a", "b", "c"]')).toEqual([
        {type: 'text', value: 'tags: '},
        {type: 'json', value: '["a", "b", "c"]'},
      ]);
    });
  });

  describe('text preservation invariant', () => {
    const cases = [
      'hello world',
      'prefix {"key": "value"} suffix',
      'a {"x": 1} b {"y": 2} c',
      '{"a": 1}{"b": 2}',
      'no json here {invalid} at all',
      'mixed {"valid": true} and {invalid} stuff',
      '',
      '{"only": "json"}',
      'trailing text after {"json": true}',
      '{"json": true} leading text before',
      'braces } without { matching [ pairs ]',
      'log: {"pattern": "{user}"}',
    ];

    it.each(cases)('concatenating segments reproduces the original: %s', input => {
      const segments = extractJsonFromText(input);
      const reconstructed = segments.map(s => s.value).join('');
      expect(reconstructed).toBe(input);
    });
  });

  describe('mixed valid and invalid JSON', () => {
    it('extracts valid JSON surrounded by invalid braces', () => {
      expect(extractJsonFromText('{bad} {"good": true} {bad}')).toEqual([
        {type: 'text', value: '{bad} '},
        {type: 'json', value: '{"good": true}'},
        {type: 'text', value: ' {bad}'},
      ]);
    });

    it('handles valid JSON after several invalid brace pairs', () => {
      expect(extractJsonFromText('{a} {b} {c} {"d": 1}')).toEqual([
        {type: 'text', value: '{a} {b} {c} '},
        {type: 'json', value: '{"d": 1}'},
      ]);
    });

    it('handles invalid brace pair after valid JSON', () => {
      expect(extractJsonFromText('{"a": 1} {b} done')).toEqual([
        {type: 'json', value: '{"a": 1}'},
        {type: 'text', value: ' {b} done'},
      ]);
    });
  });

  describe('whitespace handling', () => {
    it('preserves whitespace in text segments', () => {
      expect(extractJsonFromText('  {"a": 1}  ')).toEqual([
        {type: 'text', value: '  '},
        {type: 'json', value: '{"a": 1}'},
        {type: 'text', value: '  '},
      ]);
    });

    it('handles JSON with internal whitespace', () => {
      expect(extractJsonFromText('d: { "key" : "value" }')).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: '{ "key" : "value" }'},
      ]);
    });

    it('handles multiline JSON', () => {
      const json = '{\n  "key": "value"\n}';
      expect(extractJsonFromText(`d: ${json} end`)).toEqual([
        {type: 'text', value: 'd: '},
        {type: 'json', value: json},
        {type: 'text', value: ' end'},
      ]);
    });
  });

  describe('real-world log patterns', () => {
    it('extracts JSON from a log line', () => {
      expect(
        extractJsonFromText(
          '2024-01-15 10:30:00 INFO {"event": "login", "user": "alice"}'
        )
      ).toEqual([
        {type: 'text', value: '2024-01-15 10:30:00 INFO '},
        {type: 'json', value: '{"event": "login", "user": "alice"}'},
      ]);
    });

    it('extracts JSON from a message with context', () => {
      expect(
        extractJsonFromText(
          'This is my JSON: { "it": "would be", "nice": ["to", "highlight"], "this": true }'
        )
      ).toEqual([
        {type: 'text', value: 'This is my JSON: '},
        {
          type: 'json',
          value: '{ "it": "would be", "nice": ["to", "highlight"], "this": true }',
        },
      ]);
    });

    it('extracts JSON from an error message', () => {
      expect(
        extractJsonFromText(
          'Failed to process request: {"error": "timeout", "code": 504} - retrying'
        )
      ).toEqual([
        {type: 'text', value: 'Failed to process request: '},
        {type: 'json', value: '{"error": "timeout", "code": 504}'},
        {type: 'text', value: ' - retrying'},
      ]);
    });

    it('handles a log line with no JSON', () => {
      expect(
        extractJsonFromText('2024-01-15 10:30:00 INFO User logged in successfully')
      ).toEqual([
        {
          type: 'text',
          value: '2024-01-15 10:30:00 INFO User logged in successfully',
        },
      ]);
    });

    it('handles a stack trace style message with braces', () => {
      expect(
        extractJsonFromText('Error at MyClass.method(file.java:42) caused by {unknown}')
      ).toEqual([
        {
          type: 'text',
          value: 'Error at MyClass.method(file.java:42) caused by {unknown}',
        },
      ]);
    });
  });
});
