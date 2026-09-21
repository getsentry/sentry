import {Issue} from './issue';
import {renderEmbedMarkdown} from './resourceEmbedTestUtils';

describe('issue embed', () => {
  it('serializes to a markdown link at the markdown level', () => {
    expect(renderEmbedMarkdown(Issue, 'issue', {id: 'JAVASCRIPT-22SP'})).toBe(
      `[JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`
    );
  });
});
