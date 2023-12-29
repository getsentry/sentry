import {browserHistory} from 'react-router';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as pageFilterUtils from 'sentry/components/organizations/pageFilters/persistence';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';

import {DEFAULT_EVENT_VIEW} from './data';
import Homepage from './homepage';

describe('Discover > Homepage', () => {
  const features = ['global-views', 'discover-query'];
  let initialData, organization, mockHomepage, measurementsMetaMock;

  beforeEach(() => {
    organization = Organization({
      features,
    });
    initialData = initializeOrg({
      organization,
      router: {
        location: LocationFixture(),
      },
    });

    ProjectsStore.loadInitialData(organization.projects);
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
      },
    });
    measurementsMetaMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      method: 'GET',
      body: {},
    });
  });

  it('renders the Discover banner', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    await screen.findByText('Discover Trends');
    screen.getByText('Get a Tour');

    expect(screen.queryByText('Build a new query')).not.toBeInTheDocument();
  });

  it('fetches from the homepage URL and renders fields, async page filters, async and chart information', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    expect(mockHomepage).toHaveBeenCalled();
    await screen.findByText('environment');

    // Only the environment field
    expect(screen.getAllByTestId('grid-head-cell').length).toEqual(1);
    screen.getByText('Previous Period');
    screen.getByText('event.type:error');
  });

  it('renders event view from URL params over homepage query', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['project'],
          },
        },
      },
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    expect(mockHomepage).toHaveBeenCalled();
    await screen.findByText('project');

    // This is the field in the mocked response for the homepage
    expect(screen.queryByText('environment')).not.toBeInTheDocument();
  });

  it('applies URL changes with the homepage pathname', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
    renderGlobalModal();

    await userEvent.click(await screen.findByText('Columns'));

    await userEvent.click(screen.getByTestId('label'));
    await userEvent.click(screen.getByText('event.type'));
    await userEvent.click(screen.getByText('Apply'));

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/discover/homepage/',
        query: expect.objectContaining({
          field: ['event.type'],
        }),
      })
    );
  });

  it('does not show an editable header or author information', async () => {
    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
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
        environment: [],
        fields: ['environment'],
        widths: ['-1'],
        range: '14d',
        orderby: '-environment',
        display: 'previous',
        query: 'event.type:error',
        topEvents: '5',
      },
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    expect(await screen.findByText('Remove Default')).toBeInTheDocument();
    expect(screen.queryByText('Set as Default')).not.toBeInTheDocument();
  });

  it('Disables the Set as Default button when no saved homepage', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
          },
        },
      },
    });
    mockHomepage = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    expect(mockHomepage).toHaveBeenCalled();
    expect(screen.getByRole('button', {name: /set as default/i})).toBeDisabled();
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });
  });

  it('follows absolute date selection', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
          },
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    await userEvent.click(await screen.findByText('24H'));
    await userEvent.click(await screen.findByText('Absolute date'));
    await userEvent.click(screen.getByText('Apply'));

    expect(screen.queryByText('14D')).not.toBeInTheDocument();
  });

  it('renders changes to the discover query when no homepage', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
      body: '',
    });

    const {rerender} = render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
    renderGlobalModal();

    // Simulate an update to the columns by changing the URL params
    const rerenderData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['event.type'],
          },
        },
      },
    });

    rerender(
      <Homepage
        organization={organization}
        location={rerenderData.router.location}
        router={rerenderData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />
    );
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('event.type')).toBeInTheDocument();
  });

  it('renders changes to the discover query when loaded with valid event view in url params', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['title'],
          },
        },
      },
    });

    const {rerender} = render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
    renderGlobalModal();

    // Simulate an update to the columns by changing the URL params
    const rerenderData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
            field: ['event.type'],
          },
        },
      },
    });

    rerender(
      <Homepage
        organization={organization}
        location={rerenderData.router.location}
        router={rerenderData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />
    );
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('event.type')).toBeInTheDocument();
  });

  it('overrides homepage filters with pinned filters if they exist', async () => {
    ProjectsStore.loadInitialData([ProjectFixture({id: '1'}), ProjectFixture({id: '2'})]);
    jest.spyOn(pageFilterUtils, 'getPageFilterStorage').mockReturnValueOnce({
      pinnedFilters: new Set(['projects']),
      state: {
        project: [2],
        environment: [],
        start: null,
        end: null,
        period: '14d',
        utc: null,
      },
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );
    await waitFor(() => {
      expect(measurementsMetaMock).toHaveBeenCalled();
    });

    expect(screen.getByText('project-slug')).toBeInTheDocument();
  });

  it('allows users to set the All Events query as default', async () => {
    initialData = initializeOrg({
      organization,
      router: {
        location: {
          ...LocationFixture(),
          query: {
            ...EventView.fromSavedQuery(DEFAULT_EVENT_VIEW).generateQueryStringObject(),
          },
        },
      },
    });
    mockHomepage = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/discover/homepage/',
      method: 'GET',
      statusCode: 200,
    });

    render(
      <Homepage
        organization={organization}
        location={initialData.router.location}
        router={initialData.router}
        setSavedQuery={jest.fn()}
        loading={false}
      />,
      {context: initialData.routerContext, organization: initialData.organization}
    );

    await waitFor(() => expect(screen.getByTestId('set-as-default')).toBeEnabled());
  });
});
