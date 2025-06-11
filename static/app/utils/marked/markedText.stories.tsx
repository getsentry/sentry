import {Fragment} from 'react';

import * as Storybook from 'sentry/stories';

import {MarkedText} from './markedText';

export default Storybook.story('MarkedText', (story, _APIReference) => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="MarkedText" /> component renders sanitized markdown
          text. It supports polymorphism via the <Storybook.JSXProperty name="as" value />{' '}
          prop and forwards refs correctly.
        </p>
        <Storybook.SizingWindow display="block">
          <MarkedText text="This is **bold** and *italic* text" />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Inline Markdown', () => {
    return (
      <Fragment>
        <p>
          Use the <Storybook.JSXProperty name="inline" value /> prop to control whether to
          wrap the markdown in a paragraph tag.
        </p>
        <Storybook.SizingWindow display="block">
          <MarkedText text="This is **bold** and *italic* text" inline />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('Custom Element', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXProperty name="as" value /> prop can be used to specify the
          element type to render as.
        </p>
        <Storybook.SizingWindow display="block">
          <MarkedText text="# This is a heading" as="section" />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('With Link', () => {
    return (
      <Fragment>
        <p>Markdown links are supported:</p>
        <Storybook.SizingWindow display="block">
          <MarkedText text="This is a [link to Sentry](https://sentry.io)" />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('With List', () => {
    return (
      <Fragment>
        <p>Markdown lists are supported:</p>
        <Storybook.SizingWindow display="block">
          <MarkedText text={`- Item 1\n- Item 2\n- Item 3`} />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });

  story('With Code Block', () => {
    return (
      <Fragment>
        <p>Markdown code blocks are supported:</p>
        <Storybook.SizingWindow display="block">
          <MarkedText
            text={`\`\`\`jsx\nconst example = "code block";\nconsole.log(example);\nconst el = <Component>Hello</Component>;\n\`\`\``}
          />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });
});
