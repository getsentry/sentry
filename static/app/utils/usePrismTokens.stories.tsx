import {Fragment} from 'react';
import styled from '@emotion/styled';

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
  max-width: 400px;
  background: var(--prism-block-background);
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};

  ${p => prismStyles(p.theme)}
  pre {
    margin: 0;
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
