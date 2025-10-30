import {OrganizationFixture} from 'sentry-fixture/organization';

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

describe('DetectorErrorsConfig.getSeriesQueryOptions', () => {
  it('adjusts statsPeriod from 7d to 9998m when interval is 60 seconds', () => {
    const options = {
      aggregate: 'count()',
      organization: OrganizationFixture(),
      projectId: '1',
      query: 'is:unresolved',
      environment: '',
      comparisonDelta: undefined,
      dataset: Dataset.ERRORS,
      eventTypes: [EventTypes.ERROR],
      interval: 60,
      statsPeriod: '7d',
    };

    const result = DetectorErrorsConfig.getSeriesQueryOptions(options);

    expect(result[1]!.query!.statsPeriod).toBe('9998m');
  });
});
