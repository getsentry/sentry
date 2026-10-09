import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import ProjectAttributes from 'sentry/views/settings/project/projectAttributes';

describe('ProjectAttributes', () => {
  const {organization} = initializeOrg({
    organization: {features: ['attribute-management']},
  });
  const project = ProjectFixture();
  const pathname = `/settings/projects/${project.slug}/attributes/`;
  const initialRouterConfig = {
    location: {pathname},
    route: '/settings/projects/:projectId/attributes/',
  };
  const attributesEndpoint = `/organizations/${organization.slug}/trace-items/attributes/merged/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders attributes with their datasets and context when the feature is enabled', async () => {
    MockApiClient.addMockResponse({
      url: attributesEndpoint,
      body: [
        {
          name: 'device.class',
          attributeType: 'string',
          attributeSource: {source_type: 'sentry'},
          datasets: ['spans', 'logs'],
          context: {
            brief: 'The classification of the device. For example, `low`.',
            isDeprecated: true,
          },
        },
        {
          name: 'cart.size',
          attributeType: 'number',
          attributeSource: {source_type: 'user'},
          datasets: ['tracemetrics'],
          context: {},
        },
      ],
    });

    render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(await screen.findByText('device.class')).toBeInTheDocument();
    expect(screen.getByText('low').tagName).toBe('CODE');
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Added by Sentry')).toHaveLength(1);
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('cart.size')).toBeInTheDocument();
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.getByText('Metrics')).toBeInTheDocument();
  });

  it('sanitizes descriptions when they contain unsafe markup', async () => {
    MockApiClient.addMockResponse({
      url: attributesEndpoint,
      body: [
        {
          name: 'unsafe.attribute',
          attributeType: 'string',
          attributeSource: {source_type: 'user'},
          datasets: ['spans'],
          context: {brief: 'Safe <img src="x" onerror="alert(1)"> text'},
        },
      ],
    });

    render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(await screen.findByText('unsafe.attribute')).toBeInTheDocument();
    expect(screen.getByText(/Safe/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('row', {name: /unsafe\.attribute/})).queryByRole('img')
    ).not.toBeInTheDocument();
  });

  it('requests sorted results from the first page when a column header is clicked', async () => {
    const request = MockApiClient.addMockResponse({
      url: attributesEndpoint,
      body: [],
    });

    const {router} = render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {pathname, query: {cursor: '0:25:0', sort: 'type'}},
      },
    });

    await userEvent.click(await screen.findByRole('link', {name: 'Type'}));

    await waitFor(() => expect(router.location.query.sort).toBe('-type'));
    expect(router.location.query.cursor).toBeUndefined();
    expect(request).toHaveBeenLastCalledWith(
      attributesEndpoint,
      expect.objectContaining({
        query: expect.objectContaining({
          expand: 'context',
          project: [project.id],
          sort: '-type',
          statsPeriod: '14d',
        }),
      })
    );
  });

  it('shows the current row range out of the total when results are paginated', async () => {
    MockApiClient.addMockResponse({
      url: attributesEndpoint,
      body: [
        {
          name: 'cart.id',
          attributeType: 'string',
          attributeSource: {source_type: 'user'},
          datasets: ['spans'],
          context: {},
        },
      ],
      headers: {
        'X-Hits': '60',
        Link: '<http://localhost/?cursor=0:0:1>; rel="previous"; results="true"; cursor="0:0:1", <http://localhost/?cursor=0:50:0>; rel="next"; results="true"; cursor="0:50:0"',
      },
    });

    render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {pathname, query: {cursor: '0:25:0'}},
      },
    });

    expect(await screen.findByText('26-26 of 60')).toBeInTheDocument();
  });

  it('requests the chosen dataset from the first page when a dataset is selected', async () => {
    const request = MockApiClient.addMockResponse({url: attributesEndpoint, body: []});

    const {router} = render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {pathname, query: {cursor: '0:25:0'}},
      },
    });

    await userEvent.click(await screen.findByRole('button', {name: /Dataset/}));
    await userEvent.click(screen.getByRole('option', {name: 'Logs'}));

    await waitFor(() => expect(router.location.query.dataset).toBe('logs'));
    expect(router.location.query.cursor).toBeUndefined();
    expect(request).toHaveBeenLastCalledWith(
      attributesEndpoint,
      expect.objectContaining({query: expect.objectContaining({dataset: 'logs'})})
    );
  });

  it('requests the chosen type when a type is selected', async () => {
    const request = MockApiClient.addMockResponse({url: attributesEndpoint, body: []});

    const {router} = render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    await userEvent.click(await screen.findByRole('button', {name: /Type/}));
    await userEvent.click(screen.getByRole('option', {name: 'boolean'}));

    await waitFor(() => expect(router.location.query.type).toBe('boolean'));
    expect(screen.queryByRole('option', {name: 'array'})).not.toBeInTheDocument();
    expect(request).toHaveBeenLastCalledWith(
      attributesEndpoint,
      expect.objectContaining({
        query: expect.objectContaining({attributeType: 'boolean'}),
      })
    );
  });

  it('requests matching attributes from the first page when a search is submitted', async () => {
    const request = MockApiClient.addMockResponse({url: attributesEndpoint, body: []});

    const {router} = render(<ProjectAttributes />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        ...initialRouterConfig,
        location: {pathname, query: {cursor: '0:25:0'}},
      },
    });

    await userEvent.type(
      await screen.findByPlaceholderText('Search attribute names or descriptions'),
      'cart{enter}'
    );

    await waitFor(() => expect(router.location.query.search).toBe('cart'));
    expect(router.location.query.cursor).toBeUndefined();
    expect(request).toHaveBeenLastCalledWith(
      attributesEndpoint,
      expect.objectContaining({query: expect.objectContaining({search: 'cart'})})
    );
  });

  it('hides the page when the feature is disabled', () => {
    const {organization: organizationWithoutFeature} = initializeOrg();
    const request = MockApiClient.addMockResponse({
      url: attributesEndpoint,
      body: [],
    });

    render(<ProjectAttributes />, {
      organization: organizationWithoutFeature,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(screen.queryByText('Attributes')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
