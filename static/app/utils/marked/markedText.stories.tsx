import {Fragment} from 'react';

import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {MarkedText} from './markedText';

export default storyBook('MarkedText', (story, _APIReference) => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="MarkedText" /> component renders sanitized markdown text. It
          supports polymorphism via the <JSXProperty name="as" value /> prop and forwards
          refs correctly.
        </p>
        <SizingWindow display="block">
          <MarkedText text="This is **bold** and *italic* text" />
        </SizingWindow>
      </Fragment>
    );
  });

  story('Inline Markdown', () => {
    return (
      <Fragment>
        <p>
          Use the <JSXProperty name="inline" value /> prop to control whether to wrap the
          markdown in a paragraph tag.
        </p>
        <SizingWindow display="block">
          <MarkedText text="This is **bold** and *italic* text" inline />
        </SizingWindow>
      </Fragment>
    );
  });

  story('Custom Element', () => {
    return (
      <Fragment>
        <p>
          The <JSXProperty name="as" value /> prop can be used to specify the element type
          to render as.
        </p>
        <SizingWindow display="block">
          <MarkedText text="# This is a heading" as="section" />
        </SizingWindow>
      </Fragment>
    );
  });

  story('With Link', () => {
    return (
      <Fragment>
        <p>Markdown links are supported:</p>
        <SizingWindow display="block">
          <MarkedText text="This is a [link to Sentry](https://sentry.io)" />
        </SizingWindow>
      </Fragment>
    );
  });

  story('With List', () => {
    return (
      <Fragment>
        <p>Markdown lists are supported:</p>
        <SizingWindow display="block">
          <MarkedText text={`- Item 1\n- Item 2\n- Item 3`} />
        </SizingWindow>
      </Fragment>
    );
  });

  story('With Code Block', () => {
    return (
      <Fragment>
        <p>Markdown code blocks are supported:</p>
        <SizingWindow display="block">
          <MarkedText
            text={`\`\`\`jsx\nconst example = "code block";\nconsole.log(example);\nconst el = <Component>Hello</Component>;\n\`\`\``}
          />
        </SizingWindow>
      </Fragment>
    );
  });
});
