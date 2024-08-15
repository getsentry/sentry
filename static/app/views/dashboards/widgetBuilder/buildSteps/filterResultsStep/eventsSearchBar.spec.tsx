import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SavedSearchType} from 'sentry/types/group';
import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {EventsSearchBar} from 'sentry/views/dashboards/widgetBuilder/buildSteps/filterResultsStep/eventsSearchBar';

describe('EventsSearchBar', () => {
  let organization;

  beforeEach(() => {
    organization = OrganizationFixture();

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/measurements-meta/`,
      body: {},
    });
  });

  it('renders recent searches for errors', async () => {
    const mockRecentSearchHistory = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [
        {
          query: 'event.type:error',
        },
      ],
    });
    render(
      <CustomMeasurementsProvider organization={organization}>
        <EventsSearchBar
          getFilterWarning={undefined}
          onClose={undefined}
          organization={organization}
          pageFilters={{
            datetime: {
              end: null,
              period: null,
              start: null,
              utc: null,
            },
            environments: [],
            projects: [],
          }}
          widgetQuery={{
            aggregates: [],
            columns: [],
            conditions: '',
            name: '',
            orderby: '',
            fieldAliases: undefined,
            fields: undefined,
            isHidden: undefined,
            onDemand: undefined,
          }}
          dataset={DiscoverDatasets.ERRORS}
          savedSearchType={SavedSearchType.ERROR}
        />
      </CustomMeasurementsProvider>
    );

    await userEvent.click(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    );
    expect(await screen.findByTestId('filter-token')).toHaveTextContent(
      'event.type:error'
    );
    expect(mockRecentSearchHistory).toHaveBeenCalledWith(
      '/organizations/org-slug/recent-searches/',
      expect.objectContaining({
        query: expect.objectContaining({
          type: SavedSearchType.ERROR,
        }),
      })
    );
  });

  it('renders recent searches for transactions', async () => {
    const mockRecentSearchHistory = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/recent-searches/`,
      body: [
        {
          query: 'transaction.status:ok',
        },
      ],
    });
    render(
      <CustomMeasurementsProvider organization={organization}>
        <EventsSearchBar
          getFilterWarning={undefined}
          onClose={undefined}
          organization={organization}
          pageFilters={{
            datetime: {
              end: null,
              period: null,
              start: null,
              utc: null,
            },
            environments: [],
            projects: [],
          }}
          widgetQuery={{
            aggregates: [],
            columns: [],
            conditions: '',
            name: '',
            orderby: '',
            fieldAliases: undefined,
            fields: undefined,
            isHidden: undefined,
            onDemand: undefined,
          }}
          dataset={DiscoverDatasets.TRANSACTIONS}
          savedSearchType={SavedSearchType.TRANSACTION}
        />
      </CustomMeasurementsProvider>
    );

    await userEvent.click(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    );
    expect(await screen.findByTestId('filter-token')).toHaveTextContent(
      'transaction.status:ok'
    );
    expect(mockRecentSearchHistory).toHaveBeenCalledWith(
      '/organizations/org-slug/recent-searches/',
      expect.objectContaining({
        query: expect.objectContaining({
          type: SavedSearchType.TRANSACTION,
        }),
      })
    );
  });
});
