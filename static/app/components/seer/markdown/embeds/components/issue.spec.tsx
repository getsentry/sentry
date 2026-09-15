import {Issue, Issues} from './issue';
import {renderEmbedMarkdown} from './resourceEmbedTestUtils';

describe('issue embed', () => {
  it('serializes to a markdown link at the markdown level', () => {
    expect(renderEmbedMarkdown(Issue, 'issue', {id: 'JAVASCRIPT-22SP'})).toBe(
      `[JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`
    );
  });
});

describe('issues embed', () => {
  it('serializes the table it was listing to one markdown link per issue', () => {
    const markdown = renderEmbedMarkdown(Issues, 'issues', {
      ids: ['JAVASCRIPT-22SP', 'PYTHON-4B'],
    });

    expect(markdown).toBe(
      [
        `- [JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`,
        `- [PYTHON-4B](${window.location.origin}/issues/PYTHON-4B/)`,
      ].join('\n')
    );
  });

  it('renders nothing for an empty list', () => {
    expect(renderEmbedMarkdown(Issues, 'issues', {ids: []})).toBe('');
  });
});
