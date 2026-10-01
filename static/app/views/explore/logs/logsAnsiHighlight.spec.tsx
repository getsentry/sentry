import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LogsAnsiHighlight} from 'sentry/views/explore/logs/logsAnsiHighlight';

describe('LogsAnsiHighlight', () => {
  it('highlights search terms when given plain text', () => {
    render(<LogsAnsiHighlight terms={['connect']}>failed to connect</LogsAnsiHighlight>);

    expect(screen.getByText('connect').tagName).toBe('SPAN');
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
