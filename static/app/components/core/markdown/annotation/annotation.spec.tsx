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
    // Cut after the reference, before the separator, and after the opening mark.
    const cutInReference = text.slice(0, text.indexOf('[email]') - 1);
    const cutInText = text.slice(text.indexOf('[em'));

    expect(splitAnnotations(cutInReference)).toEqual(['Mail ']);
    expect(stripAnnotations(cutInReference)).toBe('Mail ');
    expect(stripAnnotations(cutInText)).toBe('[email] today');
    expect(splitAnnotations(cutInText)).toEqual(['[email] today']);
  });

  it('keeps the annotations after the marks of one that was cut', () => {
    const annotation = {text: '[email]', data: '{"rule":"@email:replace"}'};
    // A closing mark left before an annotation.
    const closeLeft = text.slice(text.indexOf('[email]'));
    // An opening mark and its reference before an annotation.
    const openLeft = text.slice(0, text.indexOf('[email]') - 1);

    expect(splitAnnotations(`${closeLeft} ${text}`)).toEqual([
      '[email] today Mail ',
      annotation,
      ' today',
    ]);
    expect(splitAnnotations(`${openLeft}${text}`)).toEqual([
      'Mail Mail ',
      annotation,
      ' today',
    ]);
  });

  it('drops the marks of an annotation that was cut in markdown', () => {
    const openLeft = text.slice(0, text.indexOf('[email]') - 1);
    const closeLeft = text.slice(text.indexOf('[email]'));
    const {container} = render(<Markdown raw={`${openLeft} and ${closeLeft}`} />);

    expect(container).toHaveTextContent('Mail and [email] today');
    expect(container).not.toHaveTextContent(/[\uFDD0-\uFDD2\uE100-\uE17F]/);
  });

  it('passes annotations of empty text to the component', () => {
    render(
      <Markdown
        raw={`Mail ${annotate('', '{"rule":"@anything:remove"}')}today`}
        components={{
          Annotation: ({data}) => <mark data-test-id="annotation" title={data} />,
        }}
      />
    );

    expect(screen.getByTestId('annotation')).toHaveAttribute(
      'title',
      '{"rule":"@anything:remove"}'
    );
  });

  it('keeps the data out of the text', () => {
    const data = JSON.stringify({
      ruleId: '@email:replace',
      remark: 's',
      note: 'x'.repeat(500),
    });
    const first = annotate('[email]', data);
    const second = annotate('[phone]', data);

    // An opening mark, a reference, a separator, and a closing mark.
    expect(first).toHaveLength('[email]'.length + 4);
    // The same data gets the same reference.
    expect(second.replace('[phone]', '[email]')).toBe(first);
    expect(splitAnnotations(`${first} ${second}`)).toEqual([
      {text: '[email]', data},
      ' ',
      {text: '[phone]', data},
    ]);
  });

  it('keeps references apart once they need more than one character', () => {
    const annotations = Array.from({length: 300}, (_, index) =>
      annotate(`${index}`, `{"rule":"@rule-${index}"}`)
    );

    expect(splitAnnotations(annotations[299]!)).toEqual([
      {text: '299', data: '{"rule":"@rule-299"}'},
    ]);
    expect(splitAnnotations(annotations[3]!)).toEqual([
      {text: '3', data: '{"rule":"@rule-3"}'},
    ]);
  });

  it('gives annotations with an unknown reference no data', () => {
    const unknown = 'Mail \uFDD0\uE17F\uE17F\uE17F\uFDD1[email]\uFDD2 today';

    expect(splitAnnotations(unknown)).toEqual([
      'Mail ',
      {text: '[email]', data: ''},
      ' today',
    ]);
    expect(stripAnnotations(unknown)).toBe('Mail [email] today');
  });

  it('leaves private use characters, like icon font glyphs, alone', () => {
    const icons = 'build \uE000 ok \uE002 done';

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
