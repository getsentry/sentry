import 'prism-sentry/index.css';

import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';
import Prism from 'prismjs';

type Props = {
  code: string;
};

function HTMLCode({code}: Props) {
  const codeRef = useRef<HTMLModElement | null>(null);
  const formattedCode = beautify.html(code, {indent_size: 2});

  useEffect(() => {
    Prism.highlightElement(codeRef.current, false);
  }, []);

  return (
    <CodeWrapper>
      <pre>
        <code ref={codeRef} className="language-html">
          {formattedCode}
        </code>
      </pre>
    </CodeWrapper>
  );
}

const CodeWrapper = styled('div')`
  pre {
    word-break: break-all;
    white-space: pre-wrap;
  }
`;

export default HTMLCode;
