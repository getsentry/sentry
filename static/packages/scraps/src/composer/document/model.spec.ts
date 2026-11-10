import {parseComposerDocument} from './model';

describe('ComposerDocument validation', () => {
  it('canonicalizes marks and adjacent text without changing reference identity', () => {
    expect(
      parseComposerDocument({
        version: 1,
        blocks: [
          {
            type: 'paragraph',
            children: [
              {type: 'text', text: 'one', marks: ['italic', 'bold', 'bold']},
              {type: 'text', text: ' two', marks: ['bold', 'italic']},
              {type: 'text', text: '', marks: []},
              {type: 'mention', actorType: 'user', id: '1', label: 'Alice'},
              {type: 'reference', kind: 'issue', id: '123', label: 'PROJ-1'},
            ],
          },
        ],
      })
    ).toEqual({
      version: 1,
      blocks: [
        {
          type: 'paragraph',
          children: [
            {type: 'text', text: 'one two', marks: ['bold', 'italic']},
            {type: 'mention', actorType: 'user', id: '1', label: 'Alice'},
            {type: 'reference', kind: 'issue', id: '123', label: 'PROJ-1'},
          ],
        },
      ],
    });
  });

  it.each([
    {version: 2, blocks: []},
    {version: 1, blocks: [{type: 'widget', data: {}}]},
    {
      version: 1,
      blocks: [
        {type: 'paragraph', children: [{type: 'text', text: 'bad', marks: ['unknown']}]},
      ],
    },
    {version: 1, blocks: [{type: 'attachment', id: '1', name: 'file.txt'}]},
    {version: 1, blocks: [], unexpected: true},
  ])('rejects unsupported document data %#', value => {
    expect(() => parseComposerDocument(value)).toThrow();
  });
});
