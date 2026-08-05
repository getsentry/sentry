import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MultiHighlight} from 'sentry/components/highlight';

describe('MultiHighlight', () => {
  it('highlights every provided term when the text contains multiple terms', () => {
    render(
      <MultiHighlight terms={['error', 'timeout']}>
        request failed with error after timeout
      </MultiHighlight>
    );

    expect(screen.getByText('error').tagName.toLowerCase()).toBe('span');
    expect(screen.getByText('timeout').tagName.toLowerCase()).toBe('span');
  });

  it('highlights every occurrence of a term when it repeats', () => {
    render(<MultiHighlight terms={['db']}>db read then db write</MultiHighlight>);

    const highlighted = screen.getAllByText('db');

    expect(highlighted).toHaveLength(2);
    expect(highlighted.every(el => el.tagName.toLowerCase() === 'span')).toBe(true);
  });

  it('escapes regex special characters in terms', () => {
    render(
      <MultiHighlight terms={['[ERR-1+2]', '.*']}>
        got [ERR-1+2] and a .* glob
      </MultiHighlight>
    );

    expect(screen.getByText('[ERR-1+2]').tagName.toLowerCase()).toBe('span');
    expect(screen.getByText('.*').tagName.toLowerCase()).toBe('span');
  });

  it('matches regardless of case when caseSensitive is not set', () => {
    render(<MultiHighlight terms={['error']}>ERROR occurred</MultiHighlight>);

    expect(screen.getByText('ERROR').tagName.toLowerCase()).toBe('span');
  });

  it('matches only the exact case when caseSensitive is set', () => {
    render(
      <MultiHighlight caseSensitive terms={['error']}>
        ERROR then error
      </MultiHighlight>
    );

    expect(screen.getByText('error').tagName.toLowerCase()).toBe('span');
    expect(screen.queryByText('ERROR')).not.toBeInTheDocument();
  });

  it('renders plain text when no terms are provided', () => {
    render(<MultiHighlight terms={[]}>nothing to highlight</MultiHighlight>);

    expect(screen.getByText('nothing to highlight').tagName.toLowerCase()).not.toBe(
      'span'
    );
  });

  it('renders plain text when disabled', () => {
    render(
      <MultiHighlight disabled terms={['error']}>
        error occurred
      </MultiHighlight>
    );

    expect(screen.getByText('error occurred').tagName.toLowerCase()).not.toBe('span');
  });

  it('highlights the longest term when a shorter term overlaps it', () => {
    render(
      <MultiHighlight terms={['work', 'workflow']}>workflow then work</MultiHighlight>
    );

    // The longer term wins where both could match, so "workflow" stays intact
    // (a broken order would split it into "work" + an orphaned "flow").
    expect(screen.getByText('workflow').tagName.toLowerCase()).toBe('span');
    expect(screen.getByText('work').tagName.toLowerCase()).toBe('span');
    expect(screen.queryByText('flow')).not.toBeInTheDocument();
  });
});
