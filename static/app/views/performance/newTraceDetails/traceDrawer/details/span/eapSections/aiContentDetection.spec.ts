import {
  detectAIContentType,
  parseXmlTagSegments,
  preprocessInlineXmlTags,
  tryParsePythonDict,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentDetection';

describe('detectAIContentType', () => {
  it('detects valid JSON objects', () => {
    const result = detectAIContentType('{"key": "value"}');
    expect(result.type).toBe('json');
    expect(result.parsedData).toEqual({key: 'value'});
  });

  it('detects valid JSON arrays', () => {
    const result = detectAIContentType('[1, 2, 3]');
    expect(result.type).toBe('json');
    expect(result.parsedData).toEqual([1, 2, 3]);
  });

  it('does not detect JSON primitives as json type', () => {
    expect(detectAIContentType('"just a string"').type).toBe('plain-text');
    expect(detectAIContentType('42').type).toBe('plain-text');
    expect(detectAIContentType('true').type).toBe('plain-text');
  });

  it('detects Python dicts with single-quoted keys', () => {
    const result = detectAIContentType("{'key': 'value', 'flag': True}");
    expect(result.type).toBe('python-dict');
    expect(result.parsedData).toEqual({key: 'value', flag: true});
  });

  it('handles Python dicts with None and trailing commas', () => {
    const result = detectAIContentType("{'a': None, 'b': False,}");
    expect(result.type).toBe('python-dict');
    expect(result.parsedData).toEqual({a: null, b: false});
  });

  it('detects partial/truncated JSON', () => {
    const result = detectAIContentType('{"key": "value", "nested": {"inner": "trun');
    expect(result.type).toBe('fixed-json');
    expect(result.wasFixed).toBe(true);
    expect(result.parsedData).not.toBeNull();
  });

  it('detects markdown with XML tags', () => {
    const text =
      'Here is my response\n<thinking>some internal thought</thinking>\nAnd more text';
    const result = detectAIContentType(text);
    expect(result.type).toBe('markdown-with-xml');
  });

  it('detects markdown syntax', () => {
    expect(detectAIContentType('# Heading\nSome text').type).toBe('markdown');
    expect(detectAIContentType('This has **bold** text').type).toBe('markdown');
    expect(detectAIContentType('Use `code` here').type).toBe('markdown');
    expect(detectAIContentType('[link](http://example.com)').type).toBe('markdown');
    expect(detectAIContentType('> blockquote text').type).toBe('markdown');
    expect(detectAIContentType('- list item').type).toBe('markdown');
    expect(detectAIContentType('1. ordered item').type).toBe('markdown');
    expect(detectAIContentType('```\ncode block\n```').type).toBe('markdown');
  });

  it('falls back to plain text', () => {
    expect(detectAIContentType('Just some regular text here.').type).toBe('plain-text');
  });

  it('handles empty and whitespace strings', () => {
    expect(detectAIContentType('').type).toBe('plain-text');
    expect(detectAIContentType('   ').type).toBe('plain-text');
  });

  it('trims whitespace before detection', () => {
    const result = detectAIContentType('  {"key": "value"}  ');
    expect(result.type).toBe('json');
  });

  it('prefers JSON over Python dict when valid JSON', () => {
    const result = detectAIContentType('{"key": "value"}');
    expect(result.type).toBe('json');
  });

  it('falls through when parseJsonWithFix returns null for [Filtered]', () => {
    const result = detectAIContentType('[Filtered]');
    expect(result.type).toBe('plain-text');
  });
});

describe('tryParsePythonDict', () => {
  it('converts single-quoted keys to JSON', () => {
    const result = tryParsePythonDict("{'name': 'test'}");
    expect(result).toEqual({name: 'test'});
  });

  it('converts Python booleans and None', () => {
    const result = tryParsePythonDict("{'a': True, 'b': False, 'c': None}");
    expect(result).toEqual({a: true, b: false, c: null});
  });

  it('handles trailing commas', () => {
    const result = tryParsePythonDict("{'x': 1, 'y': 2,}");
    expect(result).toEqual({x: 1, y: 2});
  });

  it('returns null for non-dict text', () => {
    expect(tryParsePythonDict('hello world')).toBeNull();
  });

  it('returns null for text without single-quoted keys', () => {
    expect(tryParsePythonDict('{"key": "value"}')).toBeNull();
  });

  it('returns null for unconvertible text', () => {
    expect(tryParsePythonDict('{key: value}')).toBeNull();
  });

  it('returns null when mixed quotes produce invalid JSON', () => {
    expect(tryParsePythonDict("{'key': 'text with \"inner\" quotes'}")).toBeNull();
  });

  it('handles Python dicts where values contain markdown', () => {
    const result = tryParsePythonDict(
      "{'content': 'Given a query, you should **determine** if the passage is relevant'}"
    );
    expect(result).toEqual({
      content: 'Given a query, you should **determine** if the passage is relevant',
    });
  });
});

describe('preprocessInlineXmlTags', () => {
  it('replaces inline XML tags with italic markdown', () => {
    const text = 'Before <thinking>inner thought</thinking> After';
    expect(preprocessInlineXmlTags(text)).toBe('Before *thinking: inner thought* After');
  });

  it('leaves block-level tags at start of text untouched', () => {
    const text = '<plan>step 1</plan> then more';
    expect(preprocessInlineXmlTags(text)).toBe('<plan>step 1</plan> then more');
  });

  it('leaves block-level tags after newline untouched', () => {
    const text = 'Some text\n<thinking>deep thought</thinking>';
    expect(preprocessInlineXmlTags(text)).toBe(text);
  });

  it('handles mixed inline and block tags', () => {
    const text =
      'See the <code>details</code> here.\n<thinking>\ndeep thought\n</thinking>';
    expect(preprocessInlineXmlTags(text)).toBe(
      'See the *code: details* here.\n<thinking>\ndeep thought\n</thinking>'
    );
  });

  it('trims whitespace from inline tag content', () => {
    const text = 'before <tag>  spaced  </tag> after';
    expect(preprocessInlineXmlTags(text)).toBe('before *tag: spaced* after');
  });

  it('strips nested XML tags from inline tag content', () => {
    const text = 'Text <outer>before <inner>nested</inner> after</outer> more';
    expect(preprocessInlineXmlTags(text)).toBe('Text *outer: before nested after* more');
  });
});

describe('parseXmlTagSegments', () => {
  it('splits text with XML tags into segments', () => {
    const text = 'Before <thinking>inner thought</thinking> After';
    const segments = parseXmlTagSegments(text);
    expect(segments).toEqual([
      {type: 'text', content: 'Before '},
      {type: 'xml-tag', tagName: 'thinking', content: 'inner thought'},
      {type: 'text', content: ' After'},
    ]);
  });

  it('handles multiple XML tags', () => {
    const text = '<plan>step 1</plan> then <result>done</result>';
    const segments = parseXmlTagSegments(text);
    expect(segments).toEqual([
      {type: 'xml-tag', tagName: 'plan', content: 'step 1'},
      {type: 'text', content: ' then '},
      {type: 'xml-tag', tagName: 'result', content: 'done'},
    ]);
  });

  it('handles multiline content inside tags', () => {
    const text = '<thinking>\nline1\nline2\n</thinking>';
    const segments = parseXmlTagSegments(text);
    expect(segments).toEqual([
      {type: 'xml-tag', tagName: 'thinking', content: '\nline1\nline2\n'},
    ]);
  });

  it('returns single text segment when no XML tags', () => {
    expect(parseXmlTagSegments('just plain text')).toEqual([
      {type: 'text', content: 'just plain text'},
    ]);
  });

  it('handles empty string', () => {
    expect(parseXmlTagSegments('')).toEqual([]);
  });

  it('handles tags with hyphens in names', () => {
    const text = '<my-tag>content</my-tag>';
    expect(parseXmlTagSegments(text)).toEqual([
      {type: 'xml-tag', tagName: 'my-tag', content: 'content'},
    ]);
  });

  it('extracts outer tag with nested tags preserved in content', () => {
    const text =
      '<bug_report>\n<location>file.ts</location>\n<description>a bug</description>\n</bug_report>';
    expect(parseXmlTagSegments(text)).toEqual([
      {
        type: 'xml-tag',
        tagName: 'bug_report',
        content: '\n<location>file.ts</location>\n<description>a bug</description>\n',
      },
    ]);
  });
});
