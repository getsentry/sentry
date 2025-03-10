import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import LogsTextMultiHighlight from 'sentry/views/explore/logs/logsTextMultiHighlight';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getLogBodySearchTerms} from 'sentry/views/explore/logs/utils';

describe('LogsTextMultiHighlight', function () {
  it('properly escapes regex special characters in search terms', function () {
    const text =
      'This is a (text) with [regex] special characters like .* and +? and {curly} braces';
    const terms = ['(text)', '[regex]', '.*', '+?', '{curly}'];

    render(<LogsTextMultiHighlight terms={terms}>{text}</LogsTextMultiHighlight>);

    terms.forEach(term => {
      const highlightedElements = screen.getAllByText(term);
      expect(highlightedElements.length).toBeGreaterThan(0);

      const hasHighlightedSpan = highlightedElements.some(
        el => el.tagName.toLowerCase() === 'span'
      );
      expect(hasHighlightedSpan).toBe(true);
    });
  });

  it('handles regex special characters within search terms', function () {
    const text = 'The error code was [ERR-123+456]';
    const terms = ['[ERR-123+456]'];

    render(<LogsTextMultiHighlight terms={terms}>{text}</LogsTextMultiHighlight>);

    const highlightedElement = screen.getByText('[ERR-123+456]');
    expect(highlightedElement.tagName.toLowerCase()).toBe('span');
  });

  it('highlights terms parsed from complex query with getLogBodySearchTerms', function () {
    const query = `bareterm ${OurLogKnownFieldKey.BODY}:logbodyterm !bareterm2`;
    const search = new MutableSearch(query);
    const terms = getLogBodySearchTerms(search);

    const text = 'This contains bareterm and logbodyterm and !bareterm2';

    render(<LogsTextMultiHighlight terms={terms}>{text}</LogsTextMultiHighlight>);

    expect(terms).toContain('bareterm');
    expect(terms).toContain('logbodyterm');
    expect(terms).toContain('!bareterm2');

    terms.forEach(term => {
      const highlightedElements = screen.getAllByText(term);
      const hasHighlightedSpan = highlightedElements.some(
        el => el.tagName.toLowerCase() === 'span'
      );
      expect(hasHighlightedSpan).toBe(true);
    });
  });
});
