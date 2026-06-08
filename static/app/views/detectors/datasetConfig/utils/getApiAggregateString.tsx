import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {
  isTokenFunction,
  isTokenOperator,
} from 'sentry/components/arithmeticBuilder/token';
import {EQUATION_PREFIX, isEquation} from 'sentry/utils/discover/fields';

export function getApiAggregateString(aggregate: string): string {
  if (isEquation(aggregate)) {
    return aggregate;
  }

  // Check to see if this aggregate is an equation with more than one function or operators
  // This is the most reliable way we have to determine if this is an equation
  const expression = new Expression(aggregate);
  const functionComponents = expression.tokens.filter(
    token => isTokenFunction(token) || isTokenOperator(token)
  );
  // If one of the aggregates is a X_if aggregation, then it means it came from a subcomponent
  // of an equation that had a filter on it, so the input was an equation
  const hasSubcomponentConditional = functionComponents.some(
    token => isTokenFunction(token) && token.function.endsWith('_if')
  );
  if (
    expression.isValid &&
    (functionComponents.length > 1 || hasSubcomponentConditional)
  ) {
    return `${EQUATION_PREFIX}${aggregate}`;
  }
  return aggregate;
}
