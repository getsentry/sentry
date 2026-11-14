import {EventTypes} from 'sentry/views/alerts/rules/metric/types';

import {DetectorSpansConfig} from './spans';

describe('spans.separateEventTypesFromQuery', () => {
  it('returns transaction type and preserves query when is_transaction:true', () => {
    const input = 'is_transaction:true';
    const {eventTypes, query} = DetectorSpansConfig.separateEventTypesFromQuery(input);

    expect(eventTypes).toEqual([EventTypes.TRANSACTION]);
    expect(query).toBe(input);
  });

  it('returns span type and preserves query when not present', () => {
    const input = 'op:http.client status_code:200';
    const {eventTypes, query} = DetectorSpansConfig.separateEventTypesFromQuery(input);

    expect(eventTypes).toEqual([EventTypes.TRACE_ITEM_SPAN]);
    expect(query).toBe(input);
  });
});

describe('spans equations', () => {
  const equation =
    'equation|sum(gen_ai.usage.cache_read.input_tokens) / sum(gen_ai.usage.input_tokens)';

  it('titles an equation with the prefix stripped', () => {
    expect(DetectorSpansConfig.formatAggregateForTitle?.(equation)).toBe(
      'sum(gen_ai.usage.cache_read.input_tokens) / sum(gen_ai.usage.input_tokens)'
    );
  });

  it('summarizes an equation as reference labels for each unique aggregate', () => {
    expect(
      DetectorSpansConfig.getAggregateSummary?.(
        'equation|(count(span.duration) - failure_count()) / count(span.duration)'
      )
    ).toEqual({
      expression: '(A - B) / A',
      headers: ['Aggregate'],
      components: [
        {label: 'A', values: ['count(span.duration)']},
        {label: 'B', values: ['failure_count()']},
      ],
    });
  });

  it('does not summarize a single function', () => {
    expect(DetectorSpansConfig.getAggregateSummary?.('count(span.duration)')).toBeNull();
  });

  it('loads a stored equation without changing it', () => {
    expect(DetectorSpansConfig.supportsEquations).toBe(true);
    expect(DetectorSpansConfig.fromApiAggregate(equation)).toBe(equation);
    expect(DetectorSpansConfig.toApiAggregate(equation)).toBe(equation);
  });

  it('does not translate the user tag inside an equation', () => {
    const userEquation = 'equation|count_unique(user) / count_unique(user)';
    expect(DetectorSpansConfig.toApiAggregate(userEquation)).toBe(userEquation);
    expect(DetectorSpansConfig.fromApiAggregate(userEquation)).toBe(userEquation);
  });
});
