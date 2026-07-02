import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';

type HighlightTextProps = {
  query: string;
  text: string;
};

export function HighlightText({query, text}: HighlightTextProps) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || !text) {
    return text;
  }

  const matchIndex = text.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (matchIndex === -1) {
    return text;
  }

  return (
    <Text as="span" aria-label={text}>
      <Text as="span" aria-hidden="true">
        {text.slice(0, matchIndex)}
        <HighlightedMatch
          as="span"
          variant="warning"
          data-test-id="sqb-highlighted-match"
        >
          {text.slice(matchIndex, matchIndex + trimmedQuery.length)}
        </HighlightedMatch>
        {text.slice(matchIndex + trimmedQuery.length)}
      </Text>
    </Text>
  );
}

const HighlightedMatch = styled(Text)`
  background: ${p => p.theme.tokens.background.transparent.warning.muted};
  border-radius: ${p => p.theme.radius.sm};
  padding: 0 1px;
`;
