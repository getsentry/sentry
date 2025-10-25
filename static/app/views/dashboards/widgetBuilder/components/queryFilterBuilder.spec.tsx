import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

jest.mock('sentry/utils/useCustomMeasurements');
jest.mock('sentry/views/explore/contexts/spanTagsContext');

describe('QueryFilterBuilder', () => {
  let organization: Organization;
  beforeEach(() => {
    organization = OrganizationFixture({
      features: [],
    });
    jest.mocked(useCustomMeasurements).mockReturnValue({customMeasurements: {}});
    jest
      .mocked(useTraceItemTags)
      .mockReturnValue({tags: {}, secondaryAliases: {}, isLoading: false});

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('renders a dataset-specific query filter bar', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization,

        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.TABLE,
            },
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );
    expect(
      await screen.findByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization,

        router: RouterFixture({
          location: LocationFixture({
            query: {query: [], dataset: WidgetType.SPANS, displayType: DisplayType.TABLE},
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );
    expect(
      await screen.findByPlaceholderText('Search for spans, users, tags, and more')
    ).toBeInTheDocument();
  });

  it('renders a legend alias input for charts', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization,

        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );

    expect(await screen.findByPlaceholderText('Legend Alias')).toBeInTheDocument();
  });

  it('limits number of filter queries to 3', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization,

        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );

    expect(
      screen.getByPlaceholderText('Search for events, users, tags, and more')
    ).toBeInTheDocument();
    expect(await screen.findByText('+ Add Filter')).toBeInTheDocument();

    await userEvent.click(await screen.findByText('+ Add Filter'));
    await userEvent.click(await screen.findByText('+ Add Filter'));

    expect(screen.queryByText('+ Add Filter')).not.toBeInTheDocument();
  });

  it('allow adding filters for the spans dataset', async () => {
    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization,

        router: RouterFixture({
          location: LocationFixture({
            query: {query: [], dataset: WidgetType.SPANS, displayType: DisplayType.LINE},
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );

    expect(await screen.findByText('+ Add Filter')).toBeInTheDocument();
  });

  it('disables search bar when transaction widget type and discover-saved-queries-deprecation feature flag', async () => {
    const organizationWithFeature = OrganizationFixture({
      features: ['discover-saved-queries-deprecation'],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization: organizationWithFeature,

        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );

    const searchBar = await screen.findByPlaceholderText(
      'Search for events, users, tags, and more'
    );
    expect(searchBar).toBeDisabled();
  });

  it('enables search bar when transaction widget type but no discover-saved-queries-deprecation feature flag', async () => {
    const organizationWithoutFeature = OrganizationFixture({
      features: [],
    });

    render(
      <WidgetBuilderProvider>
        <WidgetBuilderQueryFilterBuilder
          onQueryConditionChange={() => {}}
          validatedWidgetResponse={{} as any}
        />
      </WidgetBuilderProvider>,
      {
        organization: organizationWithoutFeature,

        router: RouterFixture({
          location: LocationFixture({
            query: {
              query: [],
              dataset: WidgetType.TRANSACTIONS,
              displayType: DisplayType.LINE,
            },
          }),
        }),

        deprecatedRouterMocks: true,
      }
    );

    const searchBar = await screen.findByPlaceholderText(
      'Search for events, users, tags, and more'
    );
    expect(searchBar).toBeEnabled();
  });
});
