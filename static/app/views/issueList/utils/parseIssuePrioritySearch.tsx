import type {TokenResult} from 'sentry/components/searchSyntax/parser';
import {parseSearch, Token} from 'sentry/components/searchSyntax/parser';
import {PriorityLevel} from 'sentry/types';

const VALID_PRIORITIES = new Set([
  PriorityLevel.HIGH,
  PriorityLevel.MEDIUM,
  PriorityLevel.LOW,
]);

export function parseIssuePrioritySearch(query: string) {
  const parsed = parseSearch(query);

  const issuePriorityToken = parsed?.find(
    token => token.type === Token.FILTER && token.key.text === 'issue.priority'
  ) as TokenResult<Token.FILTER> | undefined;

  if (!issuePriorityToken) {
    return VALID_PRIORITIES;
  }

  const values =
    issuePriorityToken.value.type === Token.VALUE_TEXT_LIST
      ? issuePriorityToken.value.items.map(item => item.value?.text)
      : [issuePriorityToken.value.text];

  const validValues = values
    .map(value => value?.toLowerCase())
    .filter(value => VALID_PRIORITIES.has(value as PriorityLevel));

  if (issuePriorityToken.negated) {
    const priorities = new Set(VALID_PRIORITIES);
    for (const value of validValues) {
      priorities.delete(value as PriorityLevel);
    }

    return priorities;
  }

  return new Set(validValues);
}
