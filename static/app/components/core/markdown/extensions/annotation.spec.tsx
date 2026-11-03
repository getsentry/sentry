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

  it('truncates by visible characters without cutting the marks', () => {
    const truncated = truncateAnnotated(text, 10);

    expect(stripAnnotations(truncated)).toBe('Mail [e...');
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
