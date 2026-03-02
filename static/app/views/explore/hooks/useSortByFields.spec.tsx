import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useSortByFields} from 'sentry/views/explore/hooks/useSortByFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

function wrapper({children}: {children?: React.ReactNode}) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
      {children}
    </TraceItemAttributeProvider>
  );
}

describe('useSortByFields', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: [],
    });
  });

  it('returns a valid list of field options in samples mode', () => {
    const {result} = renderHookWithProviders(
      () =>
        useSortByFields({
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
      {
        additionalWrapper: wrapper,
      }
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
          fields: ['span.op', 'span.description'],
          groupBys: ['span.op'],
          yAxes: ['avg(span.duration)'],
          mode: Mode.AGGREGATE,
        }),
      {
        additionalWrapper: wrapper,
      }
    );

    expect(result.current.map(field => field.value)).toEqual([
      'avg(span.duration)',
      'span.op',
    ]);
  });
});
