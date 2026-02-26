import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {parseFunction} from 'sentry/utils/discover/fields';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

function wrapper({children}: {children?: React.ReactNode}) {
  return (
    <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
      {children}
    </TraceItemAttributeProvider>
  );
}

function useWrapper(yAxis: string) {
  const {tags: stringTags} = useTraceItemTags('string');
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: booleanTags} = useTraceItemTags('boolean');
  return useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction: parseFunction(yAxis) ?? undefined,
    traceItemType: TraceItemDataset.SPANS,
  });
}

describe('useVisualizeFields', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: [],
    });
  });

  it('returns numeric fields', () => {
    const {result} = renderHookWithProviders(() => useWrapper('avg(score.ttfb)'), {
      additionalWrapper: wrapper,
    });

    expect(result.current.map(field => field.value)).toEqual([
      'score.ttfb',
      'span.duration',
      'span.self_time',
    ]);
  });

  it('returns numeric fields for count', () => {
    const {result} = renderHookWithProviders(() => useWrapper('count(span.duration)'), {
      additionalWrapper: wrapper,
    });

    expect(result.current.map(field => field.value)).toEqual(['span.duration']);
  });

  it('returns string fields for count_unique', () => {
    const {result} = renderHookWithProviders(() => useWrapper('count_unique(foobar)'), {
      additionalWrapper: wrapper,
    });

    expect(result.current.map(field => field.value)).toEqual(
      expect.arrayContaining([
        'foobar',
        'project',
        'span.description',
        'span.op',
        'timestamp',
        'trace',
        'transaction',
      ])
    );
  });
});
