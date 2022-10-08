import 'prism-sentry/index.css';

import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';
import Prism from 'prismjs';

import space from 'sentry/styles/space';

type Props = {
  code: string;
};

function HTMLCode({code}: Props) {
  const ref = useRef<HTMLModElement | null>(null);
  const formattedCode = beautify.html(code, {indent_size: 2});

  useEffect(
    () => void (ref.current && Prism.highlightElement(ref.current, false)),
    [code]
  );

  return (
    <StyledPre>
      <code ref={ref} className="language-html">
        {formattedCode}
      </code>
    </StyledPre>
  );
}

const StyledPre = styled('pre')`
  overflow: auto !important;
  padding: ${space(1)} ${space(1.5)} !important;
  word-break: break-all;
  white-space: pre-wrap;
  margin-bottom: 0;

  /* Need font-size twice here, so ReactVirtualizedList can measure height correctly */
  font-size: ${p => p.theme.fontSizeSmall} !important;
  code {
    font-size: ${p => p.theme.fontSizeSmall} !important;
  }
`;

export default HTMLCode;
