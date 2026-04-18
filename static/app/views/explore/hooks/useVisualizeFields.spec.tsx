import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {parseFunction} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function useWrapper(yAxis: string) {
  const {attributes: stringTags} = useSpanItemAttributes({}, 'string');
  const {attributes: numberTags} = useSpanItemAttributes({}, 'number');
  const {attributes: booleanTags} = useSpanItemAttributes({}, 'boolean');
  return useVisualizeFields({
    numberTags,
    stringTags,
    booleanTags,
    parsedFunction: parseFunction(yAxis) ?? undefined,
    traceItemType: TraceItemDataset.SPANS,
  });
}

describe('useVisualizeFields', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });

    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('returns numeric fields', () => {
    const {result} = renderHookWithProviders(() => useWrapper('avg(score.ttfb)'), {
      organization,
    });

    expect(result.current.map(field => field.value)).toEqual([
      'score.ttfb',
      'span.duration',
      'span.self_time',
    ]);
  });

  it('returns numeric fields for count', () => {
    const {result} = renderHookWithProviders(() => useWrapper('count(span.duration)'), {
      organization,
    });

    expect(result.current.map(field => field.value)).toEqual(['span.duration']);
  });

  it('returns string fields for count_unique', () => {
    const {result} = renderHookWithProviders(() => useWrapper('count_unique(foobar)'), {
      organization,
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
