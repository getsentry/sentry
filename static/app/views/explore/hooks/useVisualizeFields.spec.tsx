import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {parseFunction} from 'sentry/utils/discover/fields';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {TraceItemAttributeProvider} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <TraceItemAttributeProvider traceItemType={TraceItemDataset.SPANS} enabled>
            {children}
          </TraceItemAttributeProvider>
        </OrganizationContext>
      </QueryClientProvider>
    );
  };
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
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/trace-items/attributes/`,
      body: [],
    });

    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('returns numeric fields', () => {
    const {result} = renderHook(useWrapper, {
      wrapper: createWrapper(organization),
      initialProps: 'avg(score.ttfb)',
    });

    expect(result.current.map(field => field.value)).toEqual([
      'score.ttfb',
      'span.duration',
      'span.self_time',
    ]);
  });

  it('returns numeric fields for count', () => {
    const {result} = renderHook(useWrapper, {
      wrapper: createWrapper(organization),
      initialProps: 'count(span.duration)',
    });

    expect(result.current.map(field => field.value)).toEqual(['span.duration']);
  });

  it('returns string fields for count_unique', () => {
    const {result} = renderHook(useWrapper, {
      wrapper: createWrapper(organization),
      initialProps: 'count_unique(foobar)',
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
