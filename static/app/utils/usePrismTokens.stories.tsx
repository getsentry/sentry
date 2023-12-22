import {Fragment} from 'react';
import styled from '@emotion/styled';

import ObjectInspector from 'sentry/components/objectInspector';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';
import {prismStyles} from 'sentry/styles/prism';
import {space} from 'sentry/styles/space';
import {SyntaxHighlightLine, usePrismTokens} from 'sentry/utils/usePrismTokens';

const JS_CODE = `function foo() {
  // Returns 'bar'
  return 'bar';
}`;

function TestComponent({
  languange,
  lines,
}: {
  languange: string;
  lines: SyntaxHighlightLine[];
}) {
  return (
    <Wrapper>
      <pre className={`language-${languange}`}>
        <code>
          {lines.map((line, i) => (
            <Line key={i}>
              <LineNumber>ln: {i + 1}</LineNumber>
              <div>
                {line.map((token, j) => (
                  <span key={j} className={token.className}>
                    {token.children}
                  </span>
                ))}
              </div>
            </Line>
          ))}
        </code>
      </pre>
    </Wrapper>
  );
}

export default storyBook('usePrismTokens', story => {
  story('Default', () => {
    const lines = usePrismTokens({code: JS_CODE, language: 'js'});

    return (
      <Fragment>
        <p>
          By default <code>usePrismTokens</code> will return an array of lines, each line
          containing an array of code tokens. Each token is an object with{' '}
          <code>className</code> and <code>children</code> props for your to render.
        </p>
        <p>
          Here is the result of passing in this code with the language set to{' '}
          <code>js</code>
        </p>
        <table>
          <tr>
            <th>Input</th>
            <td>
              <code>
                <pre>{JS_CODE}</pre>
              </code>
            </td>
          </tr>
          <tr>
            <th>Output</th>
            <td>
              <ObjectInspector
                data={lines}
                expandLevel={2}
                theme={{
                  TREENODE_FONT_SIZE: '0.7rem',
                  ARROW_FONT_SIZE: '0.5rem',
                }}
              />
            </td>
          </tr>
        </table>
      </Fragment>
    );
  });

  story('With custom renderer', () => {
    const lines = usePrismTokens({code: JS_CODE, language: 'js'});

    return (
      <Fragment>
        <p>
          The <code>usePrismTokens</code> hook is meant to be used for code blocks which
          require custom UI or behavior, such as customizing line numbers of highlighting
          parts of the code. If this is not required, use the{' '}
          <JSXNode name="CodeSnippet" /> component or{' '}
          <code>Prism.highlightElement()</code>.
        </p>
        <SizingWindow display="block">
          <TestComponent languange="js" lines={lines} />
        </SizingWindow>
      </Fragment>
    );
  });
});

const Wrapper = styled('div')`
  background: var(--prism-block-background);

  ${p => prismStyles(p.theme)}

  pre {
    margin: 0;
    padding: 0;
  }
`;

const Line = styled('div')`
  display: grid;
  grid-template-columns: 58px 1fr;
  gap: ${space(1)};
  height: 22px;
  line-height: 22px;
  background-color: ${p => p.theme.background};
`;

const LineNumber = styled('div')`
  background: ${p => p.theme.purple400};
  color: ${p => p.theme.white};
  padding: 0 ${space(1)};
`;
