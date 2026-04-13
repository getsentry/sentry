import type {SnubaQuery} from 'sentry/types/workflowEngine/detectors';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {DetectorErrorsConfig} from 'sentry/views/detectors/datasetConfig/errors';

describe('DetectorErrorsConfig.toSnubaQueryString', () => {
  it('omits event.type when defaults provided in any order', () => {
    const snubaQuery: SnubaQuery = {
      aggregate: 'count()',
      dataset: Dataset.ERRORS,
      eventTypes: [EventTypes.DEFAULT, EventTypes.ERROR],
      id: 'test-id',
      query: 'is:unresolved',
      timeWindow: 60,
      environment: '',
    };

    const result = DetectorErrorsConfig.toSnubaQueryString(snubaQuery);
    expect(result).toBe('is:unresolved');
  });

  it('adds event.type filter when a single event type is selected', () => {
    const snubaQuery: SnubaQuery = {
      aggregate: 'count()',
      dataset: Dataset.ERRORS,
      eventTypes: [EventTypes.ERROR],
      id: 'test-id',
      query: 'is:unresolved',
      timeWindow: 60,
      environment: '',
    };

    const result = DetectorErrorsConfig.toSnubaQueryString(snubaQuery);
    expect(result).toBe('event.type:error is:unresolved');
  });
});
