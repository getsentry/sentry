import {
  DEFAULT_EVENT_TYPES_BY_DATASET,
  parseEventTypesFromQuery,
} from 'sentry/views/detectors/datasetConfig/eventTypes';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

describe('eventTypes.parseEventTypesFromQuery', () => {
  it('extracts list and cleans query (errors)', () => {
    const input = 'event.type:[error, default] is:unresolved';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS]
    );

    expect(eventTypes.toSorted()).toEqual(['default', 'error']);
    expect(query).toBe('is:unresolved');
  });

  it('extracts single and cleans query (transactions)', () => {
    const input = 'event.type:transaction transaction.duration:>0';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.TRANSACTIONS]
    );

    expect(eventTypes).toEqual(['transaction']);
    expect(query).toBe('transaction.duration:>0');
  });

  it('defaults when no event.type', () => {
    const input = 'is:unresolved';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS]
    );

    expect(eventTypes.toSorted()).toEqual(
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS].toSorted()
    );
    expect(query).toBe('is:unresolved');
  });

  it('ignores disallowed and falls back to defaults', () => {
    const input = 'event.type:[foo, bar] message:"oops"';
    const {eventTypes, query} = parseEventTypesFromQuery(
      input,
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS]
    );

    expect(eventTypes.toSorted()).toEqual(
      DEFAULT_EVENT_TYPES_BY_DATASET[DetectorDataset.ERRORS].toSorted()
    );
    expect(query).toBe('message:"oops"');
  });
});
