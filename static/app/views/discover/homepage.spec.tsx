import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersStorageFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as pageFilterUtils from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/results/data';

import Homepage from './homepage';

describe('Discover > Homepage', () => {
  const features = ['discover-query'];
  let organization: ReturnType<typeof OrganizationFixture>;
  let mockHomepage: jest.Mock;
  let measurementsMetaMock: jest.Mock;

  beforeEach(() => {
    organization = OrganizationFixture({
      features,
    });

    ProjectsStore.loadInitialData([ProjectFixture()]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-meta/',
      body: {
        count: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[123, []]]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/custom-rules/',
      body: '',
    });
    mockHomepage = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        name: 'homepage query',
        projects: [],
        version: 2,
        expired: false,
        dateCreated: '2021-04-08T17:53:25.195782Z',
        dateUpdated: '2021-04-09T12:13:18.567264Z',
        createdBy: {
          id: '2',
        },
        environment: ['alpha'],
        fields: ['environment'],
        widths: ['-1'],
        range: '24h',
        orderby: '-environment',
        display: 'previous',
        query: 'event.type:error',
        queryDataset: 'discover',
      },
    });
    measurementsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('fetches from the homepage URL and renders fields, async page filters, async and chart information', async () => {
    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    expect(mockHomepage).toHaveBeenCalled();
    await screen.findByText('environment');

    // Only the environment field
    expect(screen.getAllByTestId('grid-head-cell')).toHaveLength(1);
    screen.getByText('Previous Period');
    screen.getByRole('row', {name: 'event.type:error'});
    expect(screen.queryByText('Dataset')).not.toBeInTheDocument();
  });

  it('renders event view from URL params over homepage query', async () => {
    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['project'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    expect(mockHomepage).toHaveBeenCalled();
    await screen.findByText('project');

    // This is the field in the mocked response for the homepage
    expect(screen.queryByText('environment')).not.toBeInTheDocument();
  });

  it('applies URL changes with the homepage pathname', async () => {
    const {router} = render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });
    renderGlobalModal();

    await userEvent.click(await screen.findByText('Columns'));

    const modal = await screen.findByRole('dialog');

    await userEvent.click(within(modal).getByTestId('label'));
    await userEvent.click(within(modal).getByText('event.type'));
    await userEvent.click(within(modal).getByText('Apply'));

    await waitFor(() => {
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: expect.objectContaining({
            field: 'event.type',
          }),
        })
      );
    });
  });

  it('does not show an editable header or author information', async () => {
    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    // 'Discover' is the header for the homepage
    expect(screen.getByText('Discover')).toBeInTheDocument();
    expect(screen.queryByText(/Created by:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last edited:/)).not.toBeInTheDocument();
  });

  it('shows the Remove Default button on initial load', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/discover/homepage/`,
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        name: 'homepage query',
        projects: [],
        version: 2,
        expired: false,
        dateCreated: '2021-04-08T17:53:25.195782Z',
        dateUpdated: '2021-04-09T12:13:18.567264Z',
        createdBy: {
          id: '2',
        },
        environment: [],
        fields: ['environment'],
        widths: ['-1'],
        range: '14d',
        orderby: '-environment',
        display: 'previous',
        query: 'event.type:error',
        topEvents: '5',
        queryDataset: 'error-events',
      },
    });

    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    expect(await screen.findByText('Remove Default')).toBeInTheDocument();
    expect(screen.queryByText('Set as Default')).not.toBeInTheDocument();
  });

  it('Disables the Set as Default button when no saved homepage', async () => {
    mockHomepage = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/discover/homepage/`,
      method: 'GET',
      statusCode: 200,
    });

    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /set as default/i})).toBeDisabled();
    });

    expect(measurementsMetaMock).toHaveBeenCalled();
  });

  it('follows absolute date selection', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
    });

    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    await userEvent.click(await screen.findByText('24H'));
    await userEvent.click(await screen.findByText('Absolute date'));
    await userEvent.click(screen.getByText('Apply'));

    expect(screen.queryByText('14D')).not.toBeInTheDocument();
  });

  it('renders changes to the discover query when no homepage is saved', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
      body: '',
    });

    const {router} = render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
    });

    // Simulate navigation to update the query
    const queryParams = new URLSearchParams({
      field: 'event.type',
      sort: '-timestamp',
      statsPeriod: '24h',
      query: '',
      yAxis: 'count()',
    });
    router.navigate(
      `/organizations/${organization.slug}/explore/discover/homepage/?${queryParams.toString()}`
    );

    expect(await screen.findByText('event.type')).toBeInTheDocument();
  });

  it('renders changes to the discover query when loaded with valid event view in url params', async () => {
    const {router} = render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    await waitFor(() => {
      expect(screen.getByText('title')).toBeInTheDocument();
    });

    expect(screen.queryByText('environment')).not.toBeInTheDocument();

    const queryParams = new URLSearchParams({
      field: 'event.type',
      sort: '-timestamp',
      statsPeriod: '24h',
      query: '',
      yAxis: 'count()',
    });
    router.navigate(
      `/organizations/${organization.slug}/explore/discover/homepage/?${queryParams.toString()}`
    );

    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('event.type')).toBeInTheDocument();
  });

  it('overrides homepage filters with pinned filters if they exist', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'}), ProjectFixture({id: '2'})]);
    const state = {
      project: [2],
      environment: [],
      start: null,
      end: null,
      period: '14d',
      utc: null,
      repository: null,
    };
    jest
      .spyOn(pageFilterUtils, 'getPageFilterStorage')
      .mockReturnValueOnce(PageFiltersStorageFixture({state}));

    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('project-slug')).toBeInTheDocument();
  });

  it('allows users to set the All Events query as default', async () => {
    mockHomepage = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
    });

    render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    await waitFor(() => expect(screen.getByTestId('set-as-default')).toBeEnabled());
  });

  it('shows Set as Default when dataset differs from saved homepage', async () => {
    organization = OrganizationFixture({
      features: ['discover-basic', 'discover-query'],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {
          discoverSplitDecision: 'error-events',
        },
        data: [],
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/discover/homepage/`,
      method: 'GET',
      statusCode: 200,
      body: {
        id: '2',
        name: 'homepage query',
        projects: [],
        version: 2,
        expired: false,
        dateCreated: '2021-04-08T17:53:25.195782Z',
        dateUpdated: '2021-04-09T12:13:18.567264Z',
        createdBy: {
          id: '2',
        },
        environment: [],
        fields: ['environment'],
        widths: ['-1'],
        range: '14d',
        orderby: '-environment',
        display: 'previous',
        query: 'event.type:error',
        topEvents: '5',
        queryDataset: 'error-events',
      },
    });

    const {router} = render(<Homepage />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/explore/discover/homepage/`,
        },
        route: `/organizations/:orgId/explore/discover/homepage/`,
      },
      organization,
    });

    expect(await screen.findByText('Remove Default')).toBeInTheDocument();
    expect(screen.queryByText('Set as Default')).not.toBeInTheDocument();

    const queryParams = new URLSearchParams({
      dataset: 'transactions',
      name: 'homepage query',
      query: '',
      field: 'environment',
      queryDataset: 'transaction-like',
    });
    router.navigate(
      `/organizations/${organization.slug}/explore/discover/homepage/?${queryParams.toString()}`
    );

    expect(await screen.findByText('Set as Default')).toBeInTheDocument();
    expect(screen.queryByText('Remove Default')).not.toBeInTheDocument();
  });
});
