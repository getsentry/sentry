import styled from '@emotion/styled';

import {usePrismTokens} from 'sentry/utils/usePrismTokens';

/**
 * Prism tokenizes partial patterns without throwing, which keeps highlighting stable
 * while a pattern is typed and when the filter shows a middle-ellipsized fragment.
 */
export function HighlightedRegexPattern({pattern}: {pattern: string}) {
  const [tokens] = usePrismTokens({code: pattern, language: 'regex'});

  const isPlainText = tokens?.length === 1 && tokens[0]!.className === 'token';

  if (!tokens?.length || isPlainText) {
    return pattern;
  }

  return (
    <PatternTokens>
      {tokens.map((token, index) => (
        <span key={index} className={token.className}>
          {token.children}
        </span>
      ))}
    </PatternTokens>
  );
}

const PatternTokens = styled('span')`
  .token.group,
  .token.quantifier,
  .token.alternation,
  .token.anchor,
  .token.backreference,
  .token.char-class-punctuation,
  .token.char-class-negation,
  .token.range-punctuation {
    color: ${p => p.theme.tokens.syntax.operator};
  }

  .token.char-set,
  .token.escape,
  .token.special-escape,
  .token.group-name {
    color: ${p => p.theme.tokens.syntax.selector};
  }
`;
