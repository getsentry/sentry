import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnsiHighlight} from 'sentry/views/explore/logs/logsAnsiHighlight';

describe('LogsAnsiHighlight', () => {
  it('renders text without escape codes when given ANSI colors', () => {
    const {container} = render(
      <LogsAnsiHighlight>{'\x1B[31mfailed\x1B[0m to connect'}</LogsAnsiHighlight>
    );

    expect(container).toHaveTextContent(/^failed to connect$/);
  });

  it('blends ANSI colors into the text and background colors when given colored segments', () => {
    render(<LogsAnsiHighlight>{'\x1B[31;44mcolored'}</LogsAnsiHighlight>);

    const segment = screen.getByText('colored');
    expect(segment.style.color).toContain('color-mix(in srgb,');
    expect(segment.style.backgroundColor).toContain('color-mix(in srgb,');
  });

  it('highlights search terms inside colored segments', () => {
    render(
      <LogsAnsiHighlight terms={['connect']}>
        {'\x1B[31mfailed to connect\x1B[0m'}
      </LogsAnsiHighlight>
    );

    expect(screen.getByText('connect').tagName).toBe('SPAN');
  });
});
