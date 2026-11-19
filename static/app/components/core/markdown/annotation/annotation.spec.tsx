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
      annotate(`${index}`, `{"rule":"@many-${index}"}`)
    );

    // Past 128 distinct data, references take a second character.
    expect(annotations[299]).toHaveLength('299'.length + 5);
    // Each annotation gets its own reference, which leads back to its own data.
    const marks = annotations.map((annotation, index) =>
      annotation.replace(`${index}`, '')
    );
    expect(new Set(marks).size).toBe(annotations.length);
    annotations.forEach((annotation, index) => {
      expect(splitAnnotations(annotation)).toEqual([
        {text: `${index}`, data: `{"rule":"@many-${index}"}`},
      ]);
    });
  });

  it('drops the marks of an annotation that was cut inside its reference', () => {
    const data = Array.from({length: 200}, (_, index) => `{"rule":"@cut-${index}"}`);
    const annotated = `Mail ${data.map(item => annotate('[email]', item))[199]} today`;
    // An opening mark, a reference of two characters, and a separator.
    expect(annotated.indexOf('[email]') - annotated.indexOf('\uFDD0')).toBe(4);
    // Cut between the two characters of the reference.
    const cut = annotated.slice(0, annotated.indexOf('[email]') - 2);

    expect(splitAnnotations(cut)).toEqual(['Mail ']);
    expect(stripAnnotations(cut)).toBe('Mail ');
    expect(splitAnnotations(`${cut}${annotated}`)).toEqual([
      'Mail Mail ',
      {text: '[email]', data: data[199]},
      ' today',
    ]);
  });

  it.each([
    ['empty data', ''],
    ['data with marks and private use characters', 'a\uFDD0b\uFDD1c\uFDD2 \uE100\uE17F'],
    ['data in other scripts and with emoji', 'Café 🙂 日本語'],
  ])('keeps %s as it is', (_, data) => {
    const annotated = `Mail ${annotate('[email]', data)} today`;

    expect(splitAnnotations(annotated)).toEqual([
      'Mail ',
      {text: '[email]', data},
      ' today',
    ]);
    expect(stripAnnotations(annotated)).toBe('Mail [email] today');
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

  it('gives annotations without a reference no data', () => {
    // An empty reference doesn't lead to the first data, which `text` holds.
    expect(splitAnnotations('Mail \uFDD0\uFDD1[email]\uFDD2 today')).toEqual([
      'Mail ',
      {text: '[email]', data: ''},
      ' today',
    ]);
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
    // Annotating the kept text again reuses the reference of its data.
    expect(truncated.slice(0, truncated.indexOf('[e'))).toBe(
      text.slice(0, text.indexOf('[email]'))
    );
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

  it('drops the marks in code, which is not parsed for annotations', () => {
    const marked = annotate('[email]', '{"rule":"@email:replace"}');
    const {container} = render(
      <Markdown
        raw={[
          `Inline \`send(${marked})\` code`,
          `\`\`\`\nfenced(${marked})\n\`\`\``,
          `~~~\ntilde(${marked})\n~~~`,
          `    indented(${marked})`,
        ].join('\n\n')}
      />
    );

    expect(container).toHaveTextContent('send([email])');
    expect(container).toHaveTextContent('fenced([email])');
    expect(container).toHaveTextContent('tilde([email])');
    expect(container).toHaveTextContent('indented([email])');
    expect(container).not.toHaveTextContent(/[\uFDD0-\uFDD2\uE100-\uE17F]/);
  });

  it('renders annotations as plain text without a component', () => {
    render(<Markdown raw={text} />);

    expect(screen.getByText('Mail [email] today')).toBeInTheDocument();
  });
});
