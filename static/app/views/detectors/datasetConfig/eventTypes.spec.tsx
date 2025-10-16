import {DetectorErrorsConfig} from 'sentry/views/detectors/datasetConfig/errors';
import {parseEventTypesFromQuery} from 'sentry/views/detectors/datasetConfig/eventTypes';
import {DetectorTransactionsConfig} from 'sentry/views/detectors/datasetConfig/transactions';

describe('eventTypes.parseEventTypesFromQuery', () => {
  it('extracts list and cleans query (errors)', () => {
    const input = 'event.type:[error, default] is:unresolved';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DetectorErrorsConfig.defaultEventTypes
    );

    expect(eventTypes.toSorted()).toEqual(['default', 'error']);
    expect(query).toBe('is:unresolved');
  });

  it('extracts single and cleans query (transactions)', () => {
    const input = 'event.type:transaction transaction.duration:>0';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DetectorTransactionsConfig.defaultEventTypes
    );

    expect(eventTypes).toEqual(['transaction']);
    expect(query).toBe('transaction.duration:>0');
  });

  it('defaults when no event.type', () => {
    const input = 'is:unresolved';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DetectorErrorsConfig.defaultEventTypes
    );

    expect(eventTypes.toSorted()).toEqual(
      DetectorErrorsConfig.defaultEventTypes.toSorted()
    );
    expect(query).toBe('is:unresolved');
  });

  it('ignores disallowed and falls back to defaults', () => {
    const input = 'event.type:[foo, bar] message:"oops"';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DetectorErrorsConfig.defaultEventTypes
    );

    expect(eventTypes.toSorted()).toEqual(
      DetectorErrorsConfig.defaultEventTypes.toSorted()
    );
    expect(query).toBe('message:"oops"');
  });

  it('normalizes ordering', () => {
    const input = 'event.type:[default, error] is:unresolved';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DetectorErrorsConfig.defaultEventTypes
    );

    expect(eventTypes).toEqual(['default', 'error']);
    expect(query).toBe('is:unresolved');
  });
});
