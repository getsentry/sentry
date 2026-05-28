import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AnsiText} from 'sentry/components/ansiText';

describe('AnsiText', () => {
  it('renders ANSI standard and bright colors without escape codes', () => {
    render(<AnsiText text={'\u001B[31mred\u001B[0m plain \u001B[91mbright\u001B[0m'} />);

    expect(screen.getByText('red')).toHaveStyle({color: ThemeFixture().colors.red500});
    expect(screen.getByText('bright')).toHaveStyle({
      color: ThemeFixture().colors.red200,
    });
    expect(screen.queryByText(text => text.includes('\u001B'))).not.toBeInTheDocument();
  });

  it('renders nested ANSI foreground and background colors with reset behavior', () => {
    render(<AnsiText text={'hello \u001B[32mwo\u001B[43mrl\u001B[0;md'} />);

    expect(screen.getByText('wo')).toHaveStyle({
      color: ThemeFixture().colors.green500,
    });
    expect(screen.getByText('rl')).toHaveStyle({
      backgroundColor: ThemeFixture().colors.yellow500,
      color: ThemeFixture().colors.green500,
    });
    expect(screen.getByText('d')).not.toHaveStyle({
      color: ThemeFixture().colors.green500,
    });
  });

  it('renders ANSI text decorations', () => {
    render(<AnsiText text={'hello \u001B[32m\u001B[1mworld\u001B[0;m!'} />);

    expect(screen.getByText('world')).toHaveStyle({
      color: ThemeFixture().colors.green500,
      fontWeight: 'bold',
    });
    expect(screen.getByText('!')).not.toHaveStyle({
      fontWeight: 'bold',
    });
  });

  it('strips ANSI 256-color codes and renders truecolor values', () => {
    render(
      <AnsiText
        text={'\u001B[38;5;196mindexed\u001B[0m \u001B[38;2;1;2;3mtruecolor\u001B[0m'}
      />
    );

    expect(screen.getByText('indexed')).toBeInTheDocument();
    expect(screen.getByText('truecolor')).toHaveStyle({color: 'rgb(1, 2, 3)'});
    expect(screen.queryByText(text => text.includes('\u001B'))).not.toBeInTheDocument();
  });

  it('keeps URLs clickable inside ANSI colored text', () => {
    const url = 'https://docs.sentry.io';

    render(<AnsiText text={`\u001B[32m${url}\u001B[0m`} />);

    const link = screen.getByText(url).closest('a');
    expect(link).toBeInTheDocument();
    expect(link?.closest('span')).toHaveStyle({color: ThemeFixture().colors.green500});
  });

  it('can normalize terminal backspaces and carriage returns', () => {
    const {container} = render(
      <AnsiText text={'abc\bde\nprogress 10%\rprogress 20%'} normalizeTerminalSequences />
    );

    expect(container).toHaveTextContent('abde progress 20%');
  });

  it('handles terminal carriage returns across lines', () => {
    const {container} = render(
      <AnsiText
        text={'this sentence\rthat\nwill make you pause'}
        normalizeTerminalSequences
      />
    );

    expect(container).toHaveTextContent('that sentence\nwill make you pause', {
      normalizeWhitespace: false,
    });
  });

  it('does not linkify URL-ish text', () => {
    render(<AnsiText text="<transport.model.TransportInfo" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('<transport.model.TransportInfo')).toBeInTheDocument();
  });
});
