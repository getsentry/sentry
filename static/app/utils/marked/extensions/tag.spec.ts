import type {Token} from 'marked'; // eslint-disable-line no-restricted-imports
import {Marked} from 'marked'; // eslint-disable-line no-restricted-imports

import type {TagToken} from './tag';
import {blockTagExtension, inlineTagExtension} from './tag';

const tagMarked = new Marked({
  extensions: [blockTagExtension, inlineTagExtension],
});

function lex(src: string) {
  return tagMarked.lexer(src);
}

function isTagToken(token: Token): token is Token & TagToken {
  return token.type === 'tag';
}

function findTag(src: string): TagToken | undefined {
  for (const token of lex(src)) {
    if (isTagToken(token)) {
      return token;
    }
    if ('tokens' in token && Array.isArray(token.tokens)) {
      const nested = token.tokens.find(isTagToken);
      if (nested) {
        return nested;
      }
    }
  }
  return undefined;
}

function getInlineTokens(token: Token): Token[] {
  return 'tokens' in token && Array.isArray(token.tokens) ? token.tokens : [];
}

describe('marked tag extension', () => {
  describe('self-closing tags', () => {
    it('parses a standalone self-closing tag as block', () => {
      const tokens = lex('{% ref type="issue" id="PROJ-123" /%}');
      const tag = tokens.find(isTagToken);
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('ref');
      expect(tag?.level).toBe('block');
      expect(tag?.attrs).toEqual({type: 'issue', id: 'PROJ-123'});
      expect(tag?.data).toBeUndefined();
    });

    it('parses a self-closing tag with no attributes', () => {
      const tag = findTag('{% divider /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('divider');
      expect(tag?.attrs).toEqual({});
    });

    it('parses tag names with hyphens', () => {
      const tag = findTag('{% root-cause type="analysis" /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('root-cause');
      expect(tag?.attrs).toEqual({type: 'analysis'});
    });

    it('parses attribute names with hyphens', () => {
      const tag = findTag('{% ref data-type="issue" /%}');
      expect(tag).toBeDefined();
      expect(tag?.attrs).toEqual({'data-type': 'issue'});
    });
  });

  describe('block tags', () => {
    it('parses a block tag with JSON body', () => {
      const tag = findTag(
        '{% ref type="issue" id="PROJ-ABC" %}{"title":"NullPointerException"}{% /ref %}'
      );
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('ref');
      expect(tag?.level).toBe('block');
      expect(tag?.attrs).toEqual({type: 'issue', id: 'PROJ-ABC'});
      expect(tag?.data).toEqual({title: 'NullPointerException'});
    });

    it('keeps attrs and data separate', () => {
      const tag = findTag('{% ref type="issue" %}{"type":"event","count":42}{% /ref %}');
      expect(tag).toBeDefined();
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toEqual({type: 'event', count: 42});
    });

    it('parses a block tag with multi-line JSON body', () => {
      const body =
        '{\n  "one_line_description": "Race condition",\n  "count": 5, "object": {\n\t"a": [0, 1, 2]\n}\n}';
      const tag = findTag(`{% artifact type="root-cause" %}${body}{% /artifact %}`);
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('artifact');
      expect(tag?.attrs).toEqual({type: 'root-cause'});
      expect(tag?.data).toEqual({
        one_line_description: 'Race condition',
        count: 5,
        object: {a: [0, 1, 2]},
      });
    });

    it('handles invalid JSON body gracefully', () => {
      const tag = findTag('{% ref type="issue" %}not valid json{% /ref %}');
      expect(tag).toBeDefined();
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toBeUndefined();
    });

    it('parses non-object JSON body', () => {
      const tag = findTag('{% ref type="issue" %}[1,2,3]{% /ref %}');
      expect(tag).toBeDefined();
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toEqual([1, 2, 3]);
    });

    it('requires matching closing tag name', () => {
      const tag = findTag('{% ref type="issue" %}body{% /artifact %}');
      expect(tag).toBeUndefined();
    });
  });

  describe('inline tags within paragraphs', () => {
    it('parses an inline self-closing tag within text', () => {
      const tokens = lex('See {% ref type="issue" id="PROJ-123" /%} for details.');
      const paragraph = tokens.find(t => t.type === 'paragraph');
      expect(paragraph).toBeDefined();

      const tag = getInlineTokens(paragraph!).find(isTagToken);
      expect(tag).toBeDefined();
      expect(tag?.level).toBe('inline');
      expect(tag?.name).toBe('ref');
      expect(tag?.attrs).toEqual({type: 'issue', id: 'PROJ-123'});
    });

    it('parses a block tag within text as inline', () => {
      const tokens = lex(
        'Before {% chart type="line" %}{"series":[1,2]}{% /chart %} after.'
      );
      const paragraph = tokens.find(t => t.type === 'paragraph');
      expect(paragraph).toBeDefined();

      const tag = getInlineTokens(paragraph!).find(isTagToken);
      expect(tag).toBeDefined();
      expect(tag?.level).toBe('inline');
      expect(tag?.name).toBe('chart');
      expect(tag?.attrs).toEqual({type: 'line'});
      expect(tag?.data).toEqual({series: [1, 2]});
    });
  });

  describe('arbitrary tag names', () => {
    it('parses any valid tag name', () => {
      const tag = findTag('{% chart type="line" /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('chart');
    });

    it('parses tag names with underscores', () => {
      const tag = findTag('{% code_change type="diff" /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('code_change');
    });

    it('parses single-word tag names with numbers', () => {
      const tag = findTag('{% widget2 type="bar" /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('widget2');
    });

    it('parses block tags with arbitrary names', () => {
      const tag = findTag(
        '{% dashboard-preview layout="grid" %}{"widgets":["a","b"]}{% /dashboard-preview %}'
      );
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('dashboard-preview');
      expect(tag?.attrs).toEqual({layout: 'grid'});
      expect(tag?.data).toEqual({widgets: ['a', 'b']});
    });
  });

  describe('JSON body parsing', () => {
    it('parses string values', () => {
      const tag = findTag('{% note %}{"text":"hello world"}{% /note %}');
      expect(tag?.data).toEqual({text: 'hello world'});
    });

    it('parses numeric values', () => {
      const tag = findTag('{% metric %}{"value":3.14,"count":0}{% /metric %}');
      expect(tag?.data).toEqual({value: 3.14, count: 0});
    });

    it('parses boolean values', () => {
      const tag = findTag('{% flag %}{"enabled":true,"deprecated":false}{% /flag %}');
      expect(tag?.data).toEqual({enabled: true, deprecated: false});
    });

    it('parses null values', () => {
      const tag = findTag('{% ref %}{"assignee":null}{% /ref %}');
      expect(tag?.data).toEqual({assignee: null});
    });

    it('parses nested objects', () => {
      const tag = findTag(
        '{% ref %}{"meta":{"priority":"high","tags":{"env":"prod"}}}{% /ref %}'
      );
      expect(tag?.data).toEqual({
        meta: {priority: 'high', tags: {env: 'prod'}},
      });
    });

    it('parses arrays within objects', () => {
      const tag = findTag(
        '{% artifact %}{"steps":[{"title":"Fix"},{"title":"Test"}]}{% /artifact %}'
      );
      expect(tag?.data).toEqual({
        steps: [{title: 'Fix'}, {title: 'Test'}],
      });
    });

    it('parses empty object body', () => {
      const tag = findTag('{% ref %}{}{% /ref %}');
      expect(tag?.data).toEqual({});
    });

    it('parses top-level string body', () => {
      const tag = findTag('{% ref type="issue" %}"just a string"{% /ref %}');
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toBe('just a string');
    });

    it('parses top-level number body', () => {
      const tag = findTag('{% ref type="issue" %}42{% /ref %}');
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toBe(42);
    });

    it('parses top-level null body', () => {
      const tag = findTag('{% ref type="issue" %}null{% /ref %}');
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toBeNull();
    });

    it('parses top-level array body', () => {
      const tag = findTag('{% ref type="issue" %}[1,2,3]{% /ref %}');
      expect(tag?.attrs).toEqual({type: 'issue'});
      expect(tag?.data).toEqual([1, 2, 3]);
    });
  });

  describe('non-interference with standard markdown', () => {
    it('does not affect heading parsing', () => {
      const tokens = lex('# Heading\n\nParagraph **bold**');
      expect(tokens[0]).toHaveProperty('type', 'heading');
      expect(tokens.find(t => t.type === 'paragraph')).toBeDefined();
    });

    it('handles tags alongside normal markdown', () => {
      const tokens = lex('# Title\n\n{% ref type="issue" id="X-1" /%}\n\nMore text');
      expect(tokens[0]).toHaveProperty('type', 'heading');
      const tag = findTag('# Title\n\n{% ref type="issue" id="X-1" /%}\n\nMore text');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('ref');
    });

    it('does not match text that looks like tags but is not', () => {
      const tag = findTag('Use {% for item in list %} for loops');
      expect(tag).toBeUndefined();
    });

    it('skips non-tag patterns to find a valid tag later in the input', () => {
      const tag = findTag('{% for item in list %}\n\n{% ref type="issue" id="X-1" /%}');
      expect(tag).toBeDefined();
      expect(tag?.name).toBe('ref');
    });
  });
});
