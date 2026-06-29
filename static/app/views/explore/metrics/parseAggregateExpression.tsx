import {
  isTokenFunction,
  type TokenFunction,
} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {EQUATION_PREFIX, isEquation} from 'sentry/utils/discover/fields';
import {
  defaultMetricQuery,
  type BaseMetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  VisualizeEquation,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {
  getFunctionLabel,
  getVisualizeLabel,
} from 'sentry/views/explore/toolbar/toolbarVisualize';

export const EQUATION_LABEL = getVisualizeLabel(1, true);

interface ParsedAggregateExpression {
  /**
   * Equation in compact form using reference labels (e.g. "A + B / 2").
   * `null` when the input is a single aggregate rather than an equation.
   */
  compactExpression: string | null;
  /**
   * The equation row itself (a `BaseMetricQuery` whose visualize is an
   * equation). `null` when the input is a single aggregate.
   */
  equationRow: BaseMetricQuery | null;
  metricQueries: BaseMetricQuery[];
}

const IF_SUFFIX = '_if';

interface ParsedEquationComponent {
  /**
   * The filter query from the conditional aggregation if applicable.
   */
  filterQuery: string;
  /**
   * Function call in its plain `op(value,metric,type,unit)` form with the
   * conditional argument removed.
   */
  plainAggregate: string;
}

/**
 * Parses function tokens into the format to be represented as individual metric queries.
 *
 * The main normalization that's occurring here is the removal of the `_if` combinator if
 * applicable and extraction of the query from that combinator.
 */
export function normalizeFunctionToken(token: TokenFunction): ParsedEquationComponent {
  if (!token.function.endsWith(IF_SUFFIX) || token.attributes.length === 0) {
    return {plainAggregate: token.text, filterQuery: ''};
  }

  const plainName = token.function.slice(0, -IF_SUFFIX.length);
  const [filterAttr, ...restAttrs] = token.attributes;
  const filterText = filterAttr?.text ?? '';

  // Extract the query from the first argument, checking if it's wrapped in backticks.
  const filterQuery =
    filterText.startsWith('`') && filterText.endsWith('`')
      ? filterText.slice(1, -1)
      : filterText;

  const plainAggregate = `${plainName}(${restAttrs.map(a => a.text).join(',')})`;
  return {plainAggregate, filterQuery};
}

function makeMetricQuery(
  token: TokenFunction,
  label: string,
  defaultFilter?: string
): BaseMetricQuery {
  const {plainAggregate, filterQuery} = normalizeFunctionToken(token);
  const {traceMetric} = parseMetricAggregate(plainAggregate);
  const base = defaultMetricQuery();
  return {
    metric: traceMetric,
    label,
    queryParams: base.queryParams.replace({
      aggregateFields: [new VisualizeFunction(plainAggregate)],
      query: token.function.endsWith(IF_SUFFIX) ? filterQuery : defaultFilter,
    }),
  };
}

function makeEquationRow(prefixedEquation: string, query?: string): BaseMetricQuery {
  const base = defaultMetricQuery({type: 'equation'});
  return {
    metric: {name: '', type: ''},
    queryParams: base.queryParams.replace({
      aggregateFields: [new VisualizeEquation(prefixedEquation)],
      query: query ?? '',
    }),
    label: EQUATION_LABEL,
  };
}

function defaultRow(label: string): BaseMetricQuery {
  return {...defaultMetricQuery(), label};
}

/**
 * Parses a saved aggregate string (either a single `op(value,metric,type,unit)`
 * call, or an `equation|<expression>` composed of such calls) into metric queries.
 *
 * `_if(<filter>, value, metric, type, unit)` forms are normalized so `_if` is
 * removed and the filter is extracted.
 *
 * Duplicate function calls collapse to a single row so the resulting compact
 * expression may repeat a label (e.g. `A + A` when the user summed a metric
 * with an equivalent version of itself).
 */
export function parseAggregateExpression(
  aggregate: string,
  query?: string
): ParsedAggregateExpression {
  if (!isEquation(aggregate)) {
    const tokens = tokenizeExpression(aggregate);
    const functionToken = tokens.find(isTokenFunction);
    const label = getFunctionLabel(0);
    return {
      metricQueries: [
        functionToken ? makeMetricQuery(functionToken, label, query) : defaultRow(label),
      ],
      compactExpression: null,
      equationRow: null,
    };
  }

  const expressionText = aggregate.slice(EQUATION_PREFIX.length);
  const tokens = tokenizeExpression(expressionText);

  // Tracks a label for each unique function call in the equation. To be used
  // to generate the compact expression after parsing its subcomponents.
  const labelByAggregateString = new Map<string, string>();
  const metricQueries: BaseMetricQuery[] = [];

  // Iterate over the tokens and create a metric query for each unique function call.
  for (const token of tokens) {
    if (!isTokenFunction(token)) {
      continue;
    }
    if (labelByAggregateString.has(token.text)) {
      continue;
    }
    const label = getFunctionLabel(labelByAggregateString.size);
    labelByAggregateString.set(token.text, label);
    metricQueries.push(makeMetricQuery(token, label));
  }

  const compactExpression = tokens
    .map(token => labelByAggregateString.get(token.text) ?? token.text)
    .filter(text => text.length > 0)
    .join(' ');

  return {
    metricQueries,
    compactExpression,
    equationRow: makeEquationRow(aggregate, query),
  };
}
