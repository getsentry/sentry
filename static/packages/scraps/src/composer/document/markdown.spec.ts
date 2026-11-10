import {documentFromMarkdown, documentToMarkdown, documentToPlainText} from './markdown';
import {EMPTY_DOCUMENT, parseComposerDocument, type ComposerDocument} from './model';

const mixed: ComposerDocument = {
  version: 1,
  blocks: [
    {
      type: 'paragraph',
      children: [
        {type: 'text', text: 'Hi ', marks: []},
        {type: 'mention', actorType: 'user', id: '1', label: 'Alice'},
        {type: 'text', text: ' and ', marks: []},
        {type: 'mention', actorType: 'user', id: '1', label: 'New display name'},
        {type: 'text', text: ', see ', marks: []},
        {type: 'reference', kind: 'issue', id: '123', label: 'PROJ-1'},
      ],
    },
    {type: 'quote', children: [{type: 'text', text: 'quoted\nsecond line', marks: []}]},
    {type: 'codeBlock', language: 'ts', text: 'const example = "```";\n'},
    {type: 'attachment', id: 'file-1', name: 'example.txt', mediaType: 'text/plain'},
  ],
};

describe('comment Markdown codec', () => {
  it('round-trips the supported comment nodes and durable identities', () => {
    const source = documentToMarkdown(mixed);
    expect(source).toContain('Hi {% mention %}');
    expect(source).toContain('> quoted\n> second line');
    expect(source).toContain('````ts\n');
    expect(documentFromMarkdown(source)).toEqual(parseComposerDocument(mixed));
  });

  it('uses ordinary Markdown for basic text marks', () => {
    const value: ComposerDocument = {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [
            {type: 'text', text: 'bold', marks: ['bold']},
            {type: 'text', text: ' ', marks: []},
            {type: 'text', text: 'italic', marks: ['italic']},
            {type: 'text', text: ' ', marks: []},
            {type: 'text', text: 'strike', marks: ['strike']},
            {type: 'text', text: ' ', marks: []},
            {type: 'text', text: 'x ` y', marks: ['bold', 'code']},
          ],
        },
      ],
    };
    const source = documentToMarkdown(value);
    expect(source).toContain('**bold** *italic* ~~strike~~');
    expect(documentFromMarkdown(source)).toEqual(parseComposerDocument(value));
  });

  it('escapes literal Markdown and tag delimiters in text', () => {
    const value: ComposerDocument = {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: '# [literal](link) &amp; **text** {% unknown /%}',
              marks: [],
            },
          ],
        },
      ],
    };
    expect(documentFromMarkdown(documentToMarkdown(value))).toEqual(value);
  });

  it('preserves closing-tag text inside an identity payload', () => {
    const value: ComposerDocument = {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [
            {type: 'mention', actorType: 'team', id: '2', label: '{% /mention %}'},
          ],
        },
      ],
    };
    expect(documentFromMarkdown(documentToMarkdown(value))).toEqual(value);
  });

  it.each([
    '# Unsupported heading\n\nKeep **this** source.\n',
    'Before {% unknown %}{"future":true}{% /unknown %} after.\n',
    '{% mention %}{invalid JSON}{% /mention %}\n',
    '{% mention %}{"type":"mention","actorType":"user","id":"1","label":"Alice","future":true}{% /mention %}',
    '| table |\n| --- |\n| value |\n',
    '> outer\n>\n> > nested\n',
    'original\r\nsource\r\n',
  ])('preserves unsupported source unchanged %#', source => {
    const value = documentFromMarkdown(source);
    expect(value).toEqual({version: 1, blocks: [{type: 'rawMarkdown', source}]});
    expect(documentToMarkdown(value)).toBe(source);
  });

  it('keeps mention-looking source inside code literal', () => {
    const source =
      '```\n{% mention %}{"type":"mention","actorType":"user","id":"1","label":"Alice"}{% /mention %}\n```';
    expect(documentFromMarkdown(source)).toEqual({
      version: 1,
      blocks: [
        {
          type: 'codeBlock',
          language: '',
          text: '{% mention %}{"type":"mention","actorType":"user","id":"1","label":"Alice"}{% /mention %}',
        },
      ],
    });
  });

  it('restores an empty editor document', () => {
    expect(documentFromMarkdown(documentToMarkdown(EMPTY_DOCUMENT))).toEqual(
      EMPTY_DOCUMENT
    );
  });

  it('reports tree shapes Markdown cannot represent without changing semantics', () => {
    const value: ComposerDocument = {
      version: 1,
      blocks: [
        {type: 'paragraph', children: []},
        {type: 'paragraph', children: []},
      ],
    };
    expect(() => documentToMarkdown(value)).toThrow(
      'cannot represent this document losslessly'
    );
  });

  it('provides a plain-text clipboard fallback without identity syntax', () => {
    expect(documentToPlainText(mixed)).toBe(
      'Hi Alice and New display name, see PROJ-1\n\nquoted\nsecond line\n\nconst example = "```";\n\n\nexample.txt'
    );
  });

  it('reports marked leading whitespace rather than silently removing its formatting', () => {
    const value: ComposerDocument = {
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [{type: 'text', text: ' before merging.', marks: ['bold']}],
        },
      ],
    };
    expect(() => documentToMarkdown(value)).toThrow('Marked whitespace');
  });
});
