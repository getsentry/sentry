import styled from '@emotion/styled';

import {usePrismTokens} from 'sentry/utils/usePrismTokens';

export const renderRegexPattern = (pattern: string) => (
  <HighlightedRegexPattern pattern={pattern} />
);

function HighlightedRegexPattern({pattern}: {pattern: string}) {
  const [tokens] = usePrismTokens({code: pattern, language: 'regex'});

  return (
    <PatternTokens>
      {tokens?.length
        ? tokens.map((token, index) => (
            <span key={index} className={token.className}>
              {token.children}
            </span>
          ))
        : pattern}
    </PatternTokens>
  );
}

const PatternTokens = styled('span')`
  color: ${p => p.theme.tokens.content.primary};

  .token.group,
  .token.quantifier,
  .token.alternation,
  .token.anchor,
  .token.char-class-punctuation,
  .token.char-class-negation,
  .token.range-punctuation {
    color: ${p => p.theme.tokens.syntax.operator};
  }

  .token.char-set,
  .token.escape,
  .token.special-escape {
    color: ${p => p.theme.tokens.content.success};
  }
`;
