import {useMemo} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {parseSearch, TermOperator, Token} from 'sentry/components/searchSyntax/parser';
import type {TokenResult} from 'sentry/components/searchSyntax/parser';

interface QueryTokensProps {
  /**
   * A raw Sentry search query (e.g. `dataset:spans span.op:agent.query`). It is
   * parsed into individual `key op value` filter pills. Free text and boolean
   * operators are ignored — this is a compact, read-only summary of the filters
   * an agent used, not an editable query.
   */
  query: string;
  /**
   * Optional label rendered inline before the pills (e.g. `Input:`). Kept in the
   * same wrapping row so the label and pills reflow together.
   */
  label?: string;
}

/**
 * Human-readable label for a filter's operator. The default/equality case reads
 * as "is" to match how the filters are described in prose.
 */
function getOperatorLabel(operator: TermOperator, negated: boolean): string {
  switch (operator) {
    case TermOperator.DEFAULT:
    case TermOperator.EQUAL:
      return negated ? 'is not' : 'is';
    case TermOperator.NOT_EQUAL:
      return 'is not';
    case TermOperator.GREATER_THAN:
      return '>';
    case TermOperator.GREATER_THAN_EQUAL:
      return '>=';
    case TermOperator.LESS_THAN:
      return '<';
    case TermOperator.LESS_THAN_EQUAL:
      return '<=';
    default:
      return negated ? 'is not' : 'is';
  }
}

function QueryToken({token}: {token: TokenResult<Token.FILTER>}) {
  return (
    <Flex
      align="center"
      gap="xs"
      background="primary"
      border="primary"
      radius="xs"
      paddingLeft="sm"
      paddingRight="sm"
    >
      <Text size="sm" variant="primary" monospace>
        {token.key.text}
      </Text>
      <Text size="sm" variant="secondary" monospace>
        {getOperatorLabel(token.operator, token.negated)}
      </Text>
      <Text size="sm" variant="muted" monospace>
        {token.value.text}
      </Text>
    </Flex>
  );
}

/**
 * Renders a Sentry search query as a wrapping row of compact `key op value`
 * pills. Used inside `ToolCall` to summarize the input a query-style tool call
 * ran with.
 */
export function QueryTokens({query, label}: QueryTokensProps) {
  const filters = useMemo(() => {
    const parsed = parseSearch(query);
    if (!parsed) {
      return [];
    }
    return parsed.filter(
      (token): token is TokenResult<Token.FILTER> => token.type === Token.FILTER
    );
  }, [query]);

  if (filters.length === 0) {
    return null;
  }

  return (
    <Flex align="center" gap="sm" wrap="wrap">
      {label ? (
        <Text size="sm" variant="secondary" monospace bold>
          {label}
        </Text>
      ) : null}
      {filters.map((token, i) => (
        <QueryToken key={i} token={token} />
      ))}
    </Flex>
  );
}
