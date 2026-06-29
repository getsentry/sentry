import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {
  isTokenFreeText,
  isTokenReference,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  isVisualize,
  isVisualizeEquation,
} from 'sentry/views/explore/queryParams/visualize';

/**
 * Extracts the set of reference labels (e.g. ["A", "B"]) from an Expression's tokens.
 */
export function extractReferenceLabels(expression: Expression): string[] {
  return expression.tokens.filter(isTokenReference).map(token => token.text);
}

/**
 * Takes an expression and map of references and returns the internal string representation that uses the references.
 */
export function unresolveExpression(
  expression: string,
  referenceMap: Record<string, string> = {}
): string {
  // Reverse the keys and values of the reference map, duplicates keep the first reference found
  const reversedReferenceMap = Object.entries(referenceMap).reduce(
    (reversedMap: Record<string, string>, [key, value]) => {
      if (!reversedMap[value]) {
        reversedMap[value] = key;
      }
      return reversedMap;
    },
    {}
  );

  const tokens = tokenizeExpression(expression);
  return tokens
    .map(token => {
      if (token.text in reversedReferenceMap) {
        return reversedReferenceMap[token.text] ?? token.text;
      }
      return token.text;
    })
    .join(' ');
}

/**
 * Resolves the expression using references into a format that is compatible with our querying endpoints.
 */
export function resolveExpression(
  expression: Expression,
  referenceMap: Record<string, string> = {}
): Expression {
  const newTokens = expression.tokens
    .map(token => {
      if (referenceMap && isTokenReference(token) && token.text in referenceMap) {
        return referenceMap[token.text];
      }
      if (!isTokenFreeText(token)) {
        return token.text;
      }
      return null;
    })
    .filter(Boolean);

  return new Expression(newTokens.join(' '));
}

/**
 * Creates a new set of metric queries with equations updated to use the new
 * reference map.
 *
 * If the equations are not changed, then the original metric queries are returned.
 */
export function syncEquationMetricQueries(
  metricQueries: BaseMetricQuery[],
  previousReferenceMap: Record<string, string>,
  nextReferenceMap: Record<string, string>
): BaseMetricQuery[] {
  const previousReferences = new Set(Object.keys(previousReferenceMap));
  let changed = false;

  const nextMetricQueries = metricQueries.map(metricQuery => {
    const visualize = metricQuery.queryParams.visualizes[0];

    if (!visualize || !isVisualizeEquation(visualize)) {
      return metricQuery;
    }

    const internalExpression = unresolveExpression(
      visualize.expression.text,
      previousReferenceMap
    );
    const expression = new Expression(internalExpression, previousReferences);

    if (!expression.isValid) {
      return metricQuery;
    }

    const resolvedExpression = resolveExpression(expression, nextReferenceMap);

    if (resolvedExpression.text === visualize.expression.text) {
      return metricQuery;
    }

    changed = true;

    return {
      ...metricQuery,
      queryParams: metricQuery.queryParams.replace({
        aggregateFields: metricQuery.queryParams.aggregateFields.map(field => {
          if (!isVisualize(field) || !isVisualizeEquation(field)) {
            return field;
          }

          return field.replace({
            yAxis: `${EQUATION_PREFIX}${resolvedExpression.text}`,
          });
        }),
      }),
    };
  });

  return changed ? nextMetricQueries : metricQueries;
}
