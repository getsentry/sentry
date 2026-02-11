import {EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorSpansConfig} from 'sentry/views/detectors/datasetConfig/spans';

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
