import styled from '@emotion/styled';
import beautify from 'js-beautify';

import space from 'sentry/styles/space';

type Props = {
  code: string;
};

function HTMLCode({code}: Props) {
  return (
    <CodeWrapper>
      <div className="gatsby-highlight">
        <pre className="language-html highlight">
          <code className="language-html">{beautify.html(code, {indent_size: 2})}</code>
        </pre>
      </div>
    </CodeWrapper>
  );
}

const CodeWrapper = styled('div')`
  line-height: 1.5;

  .gatsby-highlight {
    margin-bottom: ${space(3)};
  }

  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;

export default HTMLCode;
