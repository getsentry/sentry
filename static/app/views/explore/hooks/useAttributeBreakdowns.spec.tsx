import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {useAttributeBreakdowns} from 'sentry/views/explore/hooks/useAttributeBreakdowns';

describe('useAttributeBreakdowns', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('sends the case setting when ignoring case', async () => {
    const statsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/stats/',
      body: {data: []},
      match: [MockApiClient.matchQuery({caseInsensitive: '1'})],
    });

    renderHookWithProviders(
      () => useAttributeBreakdowns({cursor: undefined, substringMatch: ''}),
      {
        organization: OrganizationFixture(),
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/explore/traces/',
            query: {caseInsensitive: '1'},
          },
        },
      }
    );

    await waitFor(() => expect(statsMock).toHaveBeenCalled());
  });
});
