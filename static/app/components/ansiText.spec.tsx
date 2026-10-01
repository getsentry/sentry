import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AnsiText} from 'sentry/components/ansiText';

function renderSegments(text: string) {
  render(<AnsiText>{text}</AnsiText>);

  const wrapper = screen.getByText('FATAL').parentElement;

  return {
    segments: Array.from(wrapper?.querySelectorAll('span') ?? [], span => ({
      text: span.textContent,
      colored: span.style.color !== '',
    })),
    wrapper,
  };
}

describe('AnsiText', () => {
  it('renders text without escape codes when given ANSI colors', () => {
    const {container} = render(<AnsiText>{'\x1B[31mfailed\x1B[0m to connect'}</AnsiText>);

    expect(container).toHaveTextContent(/^failed to connect$/);
  });

  it('blends ANSI colors into the text and background colors when given colored segments', () => {
    render(<AnsiText>{'\x1B[31;44mcolored'}</AnsiText>);

    const segment = screen.getByText('colored');
    expect(segment.style.color).toContain('color-mix(in srgb,');
    expect(segment.style.backgroundColor).toContain('color-mix(in srgb,');
  });

  it('resolves 256-color and truecolor codes to their RGB values', () => {
    render(
      <AnsiText>{'\x1B[38;5;208mpalette\x1B[0m \x1B[38;2;1;2;3mtruecolor'}</AnsiText>
    );

    expect(screen.getByText('palette').style.color).toContain('rgb(255, 135, 0)');
    expect(screen.getByText('truecolor').style.color).toContain('rgb(1, 2, 3)');
  });

  it('applies every decoration when given combined decoration codes', () => {
    render(<AnsiText>{'\x1B[1;3;4;9mdecorated'}</AnsiText>);

    expect(screen.getByText('decorated')).toHaveStyle({
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecorationLine: 'underline line-through',
    });
  });

  it('removes non-color escape codes when given cursor control sequences', () => {
    const {container} = render(<AnsiText>{'\x1B[2Kdone\x1B[?25h'}</AnsiText>);

    expect(container).toHaveTextContent(/^done$/);
  });

  it('colors only the escaped text when given uncolored spaces around a colored word', () => {
    const {segments} = renderSegments(' \x1B[31mFATAL\x1B[0m ');

    expect(segments).toEqual([
      {text: ' ', colored: false},
      {text: 'FATAL', colored: true},
      {text: ' ', colored: false},
    ]);
  });

  it('colors a trailing space when given the space inside the escape codes', () => {
    const {segments} = renderSegments(' \x1B[31mFATAL \x1B[0m ');

    expect(segments).toEqual([
      {text: ' ', colored: false},
      {text: 'FATAL ', colored: true},
      {text: ' ', colored: false},
    ]);
  });

  it('colors a leading space when given the space inside the escape codes', () => {
    const {segments} = renderSegments(' \x1B[31m FATAL\x1B[0m ');

    expect(segments).toEqual([
      {text: ' ', colored: false},
      {text: ' FATAL', colored: true},
      {text: ' ', colored: false},
    ]);
  });

  it('colors only the escaped word when given uncolored text before it and a space after it', () => {
    const {segments} = renderSegments('ABC\x1B[31mFATAL\x1B[0m ');

    expect(segments).toEqual([
      {text: 'ABC', colored: false},
      {text: 'FATAL', colored: true},
      {text: ' ', colored: false},
    ]);
  });

  it('colors only the escaped word when given a space before it and uncolored text after it', () => {
    const {segments} = renderSegments(' \x1B[31mFATAL\x1B[0mABC');

    expect(segments).toEqual([
      {text: ' ', colored: false},
      {text: 'FATAL', colored: true},
      {text: 'ABC', colored: false},
    ]);
  });

  it('preserves whitespace when given escape codes', () => {
    const {wrapper} = renderSegments(' \x1B[41m FATAL \x1B[0m  ');

    expect(wrapper).toHaveStyle({whiteSpaceCollapse: 'preserve'});
  });
});
