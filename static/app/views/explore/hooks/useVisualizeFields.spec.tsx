import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {PageParamsProvider} from 'sentry/views/explore/contexts/pageParamsContext';
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
import {useVisualizeFields} from 'sentry/views/explore/hooks/useVisualizeFields';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/useLocation');
const mockedUsedLocation = jest.mocked(useLocation);

function createWrapper(organization: Organization) {
  return function ({children}: {children?: React.ReactNode}) {
    return (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext.Provider value={organization}>
          <PageParamsProvider>
            <SpanTagsProvider dataset={DiscoverDatasets.SPANS_EAP} enabled>
              {children}
            </SpanTagsProvider>
          </PageParamsProvider>
        </OrganizationContext.Provider>
      </QueryClientProvider>
    );
  };
}

describe('useVisualizeFields', () => {
  const organization = OrganizationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/spans/fields/`,
      body: [],
    });

    mockedUsedLocation.mockReturnValue(LocationFixture());
  });

  it('returns a valid list of field options', () => {
    const {result} = renderHook(
      () =>
        useVisualizeFields({
          yAxes: ['avg(span.duration)', 'avg(score.ttfb)'],
        }),
      {
        wrapper: createWrapper(organization),
      }
    );

    expect(result.current.map(field => field.value)).toEqual([
      'score.ttfb',
      'span.duration',
      'span.self_time',
    ]);
  });
});
