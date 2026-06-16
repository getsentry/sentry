import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {extractJsonFromText} from 'sentry/utils/extractJsonFromText';
import {usePrismTokens} from 'sentry/utils/usePrismTokens';

function JsonSegment({json}: {json: string}) {
  const lines = usePrismTokens({code: json, language: 'json'});

  return (
    <InlineCode className="language-json">
      {lines.map((line, lineIdx) => (
        <Fragment key={lineIdx}>
          {line.map((token, tokenIdx) => (
            <span key={tokenIdx} className={token.className}>
              {token.children}
            </span>
          ))}
        </Fragment>
      ))}
    </InlineCode>
  );
}

/**
 * Renders a string with inline syntax highlighting for embedded JSON.
 * JSON objects and arrays within the text are colorized using Prism's JSON grammar.
 * Non-JSON text is rendered as-is.
 */
export function InlineJsonHighlight({value}: {value: string}) {
  const segments = useMemo(() => extractJsonFromText(value), [value]);

  if (segments.length === 1 && segments[0]!.type === 'text') {
    return <span>{value}</span>;
  }

  return (
    <span>
      {segments.map((segment, idx) =>
        segment.type === 'json' ? (
          <JsonSegment key={idx} json={segment.value} />
        ) : (
          <Fragment key={idx}>{segment.value}</Fragment>
        )
      )}
    </span>
  );
}

const InlineCode = styled('code')`
  && {
    background: transparent;
    padding: 0;
    white-space: pre-wrap;
    font-size: inherit;
  }
`;
