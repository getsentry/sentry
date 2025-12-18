import {Fragment} from 'react';
import styled from '@emotion/styled';

import StructuredEventData from 'sentry/components/structuredEventData';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';
import type {SyntaxHighlightLine} from 'sentry/utils/usePrismTokens';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

const JS_CODE = `function foo() {
  // Returns 'bar'
  return 'bar';
}`;

const config = {
  isString: (v: any) => {
    return typeof v === 'string';
  },
};

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

export default Storybook.story('usePrismTokens', story => {
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
              <StructuredEventData
                data={lines}
                forceDefaultExpand
                maxDefaultDepth={2}
                config={config}
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
          <Storybook.JSXNode name="CodeSnippet" /> component or{' '}
          <code>Prism.highlightElement()</code>.
        </p>
        <Storybook.SizingWindow display="block">
          <TestComponent languange="js" lines={lines} />
        </Storybook.SizingWindow>
      </Fragment>
    );
  });
});

const Wrapper = styled('div')`
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
  background-color: ${p => p.theme.tokens.background.primary};
`;

const LineNumber = styled('div')`
  background: ${p => p.theme.colors.blue500};
  color: ${p => p.theme.white};
  padding: 0 ${space(1)};
`;
