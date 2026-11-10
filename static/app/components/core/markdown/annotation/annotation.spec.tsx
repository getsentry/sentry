import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  annotate,
  hasAnnotations,
  Markdown,
  splitAnnotations,
  stripAnnotations,
  truncateAnnotated,
} from '@sentry/scraps/markdown';

describe('annotations', () => {
  const text = `Mail ${annotate('[email]', '{"rule":"@email:replace"}')} today`;

  it('splits annotated text from plain text', () => {
    expect(hasAnnotations(text)).toBe(true);
    expect(splitAnnotations(text)).toEqual([
      'Mail ',
      {text: '[email]', data: '{"rule":"@email:replace"}'},
      ' today',
    ]);
  });

  it('survives JSON serialization', () => {
    const parsed = JSON.parse(JSON.stringify({content: text}));
    expect(splitAnnotations(parsed.content)[1]).toEqual({
      text: '[email]',
      data: '{"rule":"@email:replace"}',
    });
  });

  it('drops the marks of an annotation that was cut', () => {
    // Cut inside the data, before the separator, and after the opening mark.
    const cutInData = text.slice(0, text.indexOf('[email]') - 3);
    const cutInText = text.slice(text.indexOf('[em'));

    expect(splitAnnotations(cutInData)).toEqual(['Mail ']);
    expect(stripAnnotations(cutInData)).toBe('Mail ');
    expect(stripAnnotations(cutInText)).toBe('[email] today');
    expect(splitAnnotations(cutInText)).toEqual(['[email] today']);
  });

  it('leaves private use characters, like icon font glyphs, alone', () => {
    const icons = 'build  ok  done';

    expect(hasAnnotations(icons)).toBe(false);
    expect(stripAnnotations(icons)).toBe(icons);
    expect(splitAnnotations(icons)).toEqual([icons]);
  });

  it('truncates by visible characters without cutting the marks', () => {
    const truncated = truncateAnnotated(text, 7);

    expect(stripAnnotations(truncated)).toBe('Mail [e');
    expect(splitAnnotations(truncated)[1]).toEqual({
      text: '[e',
      data: '{"rule":"@email:replace"}',
    });
    expect(truncateAnnotated(text, 100)).toBe(text);
  });

  it('strips the marks', () => {
    expect(stripAnnotations(text)).toBe('Mail [email] today');
  });

  it('renders annotations in markdown with the given component', () => {
    render(
      <Markdown
        raw={`**Note:** ${text}`}
        components={{
          Annotation: ({children, data}) => (
            <mark data-test-id="annotation" title={data}>
              {children}
            </mark>
          ),
        }}
      />
    );

    expect(screen.getByTestId('annotation')).toHaveTextContent('[email]');
    expect(screen.getByTestId('annotation')).toHaveAttribute(
      'title',
      '{"rule":"@email:replace"}'
    );
  });

  it('renders annotations as plain text without a component', () => {
    render(<Markdown raw={text} />);

    expect(screen.getByText('Mail [email] today')).toBeInTheDocument();
  });
});
