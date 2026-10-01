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

  it('resolves 256-color and truecolor codes to their RGB values', () => {
    render(
      <LogsAnsiHighlight>
        {'\x1B[38;5;208mpalette\x1B[0m \x1B[38;2;1;2;3mtruecolor'}
      </LogsAnsiHighlight>
    );

    expect(screen.getByText('palette').style.color).toContain('rgb(255, 135, 0)');
    expect(screen.getByText('truecolor').style.color).toContain('rgb(1, 2, 3)');
  });

  it('applies every decoration when given combined decoration codes', () => {
    render(<LogsAnsiHighlight>{'\x1B[1;3;4;9mdecorated'}</LogsAnsiHighlight>);

    expect(screen.getByText('decorated')).toHaveStyle({
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecorationLine: 'underline line-through',
    });
  });

  it('removes non-color escape codes when given cursor control sequences', () => {
    const {container} = render(
      <LogsAnsiHighlight>{'\x1B[2Kdone\x1B[?25h'}</LogsAnsiHighlight>
    );

    expect(container).toHaveTextContent(/^done$/);
  });
});
