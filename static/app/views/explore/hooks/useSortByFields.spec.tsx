import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import type {TraceItemAttributeConfig} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);
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

    mockedUsedLocation.mockReturnValue(LocationFixture());
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
