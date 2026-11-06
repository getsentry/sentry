import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {useSortByFields} from './useSortByFields';
import type {TraceItemAttributeConfig} from './useTraceItemAttributes';

const spansConfig: TraceItemAttributeConfig = {
  traceItemType: TraceItemDataset.SPANS,
  enabled: true,
};

describe('useSortByFields', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
  });

  it('returns a valid list of field options in samples mode', () => {
    const {result} = renderHookWithProviders(
      () =>
        useSortByFields({
          config: spansConfig,
          fields: [
            'id',
            'span.op',
            'span.description',
            'span.duration',
            'transaction',
            'timestamp',
          ],
          groupBys: [],
          yAxes: ['avg(span.duration)'],
          mode: Mode.SAMPLES,
        }),
      {organization}
    );

    expect(result.current.map(field => field.value)).toEqual([
      'id',
      'span.description',
      'span.duration',
      'span.op',
      'timestamp',
      'transaction',
    ]);
  });

  it('returns a valid list of field options in aggregate mode', () => {
    const {result} = renderHookWithProviders(
      () =>
        useSortByFields({
          config: spansConfig,
          fields: ['span.op', 'span.description'],
          groupBys: ['span.op'],
          yAxes: ['avg(span.duration)'],
          mode: Mode.AGGREGATE,
        }),
      {organization}
    );

    expect(result.current.map(field => field.value)).toEqual([
      'avg(span.duration)',
      'span.op',
    ]);
  });
});
