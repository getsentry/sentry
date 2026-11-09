import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import ProjectAttributeDetails from './projectAttributeDetails';

describe('ProjectAttributeDetails', () => {
  const {organization} = initializeOrg({
    organization: {features: ['attribute-management']},
  });
  const project = ProjectFixture();
  const detailsEndpoint = `/organizations/${organization.slug}/trace-items/attributes/details/`;

  function renderDetails(
    attributeType: string,
    attributeName: string,
    query?: Record<string, string>
  ) {
    return render(<ProjectAttributeDetails />, {
      organization,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/attributes/${attributeType}/${encodeURIComponent(attributeName)}/`,
          query,
        },
        route: '/settings/projects/:projectId/attributes/:attributeType/:attributeName/',
      },
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the attribute metadata when the attribute is found', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http.method',
        attributeType: 'string',
        attributeSource: {source_type: 'sentry'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {
          brief: 'The HTTP method, such as `HEAD`.',
          details: ['Uppercased by the SDK.\n\nSent on every request.'],
          examples: ['GET', 'POST'],
          isConvention: true,
          isDeprecated: true,
          replacementAttribute: 'http.request.method',
        },
      },
    });

    renderDetails('string', 'http.method');

    expect(
      await screen.findByRole('heading', {level: 2, name: 'http.method'})
    ).toBeInTheDocument();
    expect(screen.getByText('HEAD', {selector: 'code'})).toBeInTheDocument();
    expect(screen.getByText('string')).toBeInTheDocument();
    expect(screen.getByText('Sentry convention')).toBeInTheDocument();
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
    expect(screen.getByText('http.request.method')).toBeInTheDocument();
    expect(screen.getByText('Uppercased by the SDK.')).toBeInTheDocument();
    expect(screen.getByText('Sent on every request.')).toBeInTheDocument();
    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      detailsEndpoint,
      expect.objectContaining({
        query: expect.objectContaining({
          attributeName: 'http.method',
          attributeType: 'string',
          project: [project.id],
        }),
      })
    );
  });

  it('labels the source as custom when a user attribute is not a known convention', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'cart.size',
        attributeType: 'number',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {},
      },
    });

    renderDetails('number', 'cart.size');

    expect(await screen.findByText('Custom')).toBeInTheDocument();
  });

  it('labels the source as a Sentry convention when a user attribute is a known convention', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'db.system',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {isConvention: true},
      },
    });

    renderDetails('string', 'db.system');

    expect(await screen.findByText('Sentry convention')).toBeInTheDocument();
  });

  it('renders the last seen time and cardinality when the attribute has stats', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'cart.size',
        attributeType: 'number',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: '2017-10-15T02:41:20+00:00',
        stats: {spans: {lastSeen: '2017-10-15T02:41:20+00:00', cardinality: 1234}},
      },
    });

    renderDetails('number', 'cart.size');

    expect(await screen.findByText('2 days ago')).toBeInTheDocument();
    expect(screen.getByText('≈1.2K')).toBeInTheDocument();
    expect(screen.getByText('Last 14 days')).toBeInTheDocument();
  });

  it('renders placeholders when the stats are null', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'project',
        attributeType: 'string',
        attributeSource: {source_type: 'sentry'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {brief: 'The project.'},
      },
    });

    renderDetails('string', 'project');

    expect(await screen.findByText('The project.')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders the cardinality of each dataset when the attribute is in several datasets', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'environment',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans', 'logs', 'tracemetrics'],
        lastSeen: '2017-10-15T02:41:20+00:00',
        stats: {
          spans: {lastSeen: '2017-10-15T02:41:20+00:00', cardinality: 12},
          logs: {lastSeen: null, cardinality: 3},
          tracemetrics: {lastSeen: null, cardinality: null},
        },
        context: {brief: 'The environment.'},
      },
    });

    renderDetails('string', 'environment');

    const spans = (await screen.findByText('≈12')).parentElement!;
    const logs = screen.getByText('≈3').parentElement!;
    const metrics = screen.getByText('—').parentElement!;
    expect(within(spans).getByText('Spans')).toBeInTheDocument();
    expect(within(logs).getByText('Logs')).toBeInTheDocument();
    expect(within(metrics).getByText('Metrics')).toBeInTheDocument();
  });

  it('labels the source as a Sentry convention in OpenTelemetry when the convention is in OpenTelemetry', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http.route',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {isConvention: true, isInOtel: true},
      },
    });

    renderDetails('string', 'http.route');

    expect(await screen.findByText('Sentry convention')).toBeInTheDocument();
    expect(screen.getByText('OpenTelemetry')).toBeInTheDocument();
  });

  it('labels the source as Sentry and renders the unit when Sentry defines the attribute', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'payload_size',
        attributeType: 'number',
        attributeSource: {source_type: 'sentry'},
        datasets: ['logs'],
        lastSeen: null,
        stats: {logs: {lastSeen: null, cardinality: null}},
        context: {unit: 'byte'},
      },
    });

    renderDetails('number', 'payload_size');

    expect(await screen.findByText('Sentry')).toBeInTheDocument();
    expect(screen.getByText('Bytes')).toBeInTheDocument();
  });

  it('labels the source as custom when a user attribute shares a name with a Sentry attribute', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'severity',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['logs'],
        lastSeen: null,
        stats: {logs: {lastSeen: null, cardinality: null}},
        context: {isConvention: false, brief: 'The log severity.'},
      },
    });

    renderDetails('string', 'severity');

    expect(await screen.findByText('Custom')).toBeInTheDocument();
    expect(screen.queryByText('Sentry')).not.toBeInTheDocument();
  });

  it('hides the cardinality when the attribute is a boolean', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'cache.hit',
        attributeType: 'boolean',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: '2017-10-15T02:41:20+00:00',
        stats: {spans: {lastSeen: '2017-10-15T02:41:20+00:00', cardinality: null}},
      },
    });

    renderDetails('boolean', 'cache.hit');

    expect(await screen.findByText('2 days ago')).toBeInTheDocument();
    expect(screen.queryByText('Cardinality')).not.toBeInTheDocument();
  });

  it('labels the source as custom when the attribute has custom context', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'cart.size',
        attributeType: 'number',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {isCustom: true, brief: 'Items in the cart.'},
      },
    });

    renderDetails('number', 'cart.size');

    expect(await screen.findByText('Custom')).toBeInTheDocument();
  });

  it('renders the count of values modified by Relay when the attribute is in spans', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http.url',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null, modifiedCount: 4321}},
      },
    });

    renderDetails('string', 'http.url');

    expect(await screen.findByText('Modified by Relay')).toBeInTheDocument();
    expect(screen.getByText('4,321')).toBeInTheDocument();
  });

  it('hides the count of values modified by Relay when the attribute is not in spans', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'payload_size',
        attributeType: 'number',
        attributeSource: {source_type: 'sentry'},
        datasets: ['logs'],
        lastSeen: null,
        stats: {logs: {lastSeen: null, cardinality: null}},
        context: {unit: 'byte'},
      },
    });

    renderDetails('number', 'payload_size');

    expect(await screen.findByText('Logs')).toBeInTheDocument();
    expect(screen.queryByText('Modified by Relay')).not.toBeInTheDocument();
  });

  it('hides the count of values modified by Relay when the count is unavailable', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'project',
        attributeType: 'string',
        attributeSource: {source_type: 'sentry'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null, modifiedCount: null}},
        context: {isConvention: false, brief: 'The project.', isDeprecated: false},
      },
    });

    renderDetails('string', 'project');

    expect(await screen.findByText('The project.')).toBeInTheDocument();
    expect(screen.queryByText('Modified by Relay')).not.toBeInTheDocument();
  });

  it('renders the changelog with links to its pull requests when the attribute has a changelog', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http.route',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {isConvention: true},
        changelog: [
          {version: '0.2.0', prs: [101, 102], description: 'Added `GET` as an example.'},
          {version: '0.1.0'},
        ],
      },
    });

    renderDetails('string', 'http.route');

    expect(
      await screen.findByRole('heading', {level: 3, name: 'Changelog'})
    ).toBeInTheDocument();
    expect(screen.getByText('0.2.0')).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('GET', {selector: 'code'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: '#101'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry-conventions/pull/101'
    );
    expect(screen.getByRole('link', {name: '#102'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry-conventions/pull/102'
    );
  });

  it('requests and renders the attribute when its name contains a slash', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http/route',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {brief: 'The matched route.'},
      },
    });

    renderDetails('string', 'http/route');

    expect(await screen.findByText('The matched route.')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      detailsEndpoint,
      expect.objectContaining({
        query: expect.objectContaining({attributeName: 'http/route'}),
      })
    );
  });

  it('requests the attribute by its source when the URL has a source', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'environment',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        lastSeen: null,
        stats: {spans: {lastSeen: null, cardinality: null}},
        context: {},
      },
    });

    renderDetails('string', 'environment', {source: 'user'});

    expect(await screen.findByText('Custom')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      detailsEndpoint,
      expect.objectContaining({
        query: expect.objectContaining({attributeSource: 'user'}),
      })
    );
  });

  it('renders a not found state when the attribute is not found', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      statusCode: 404,
      body: {detail: 'Attribute not found.'},
    });

    renderDetails('number', 'cart.size');

    expect(await screen.findByText('Attribute not found')).toBeInTheDocument();
  });

  it('renders an error state when the request fails for another reason', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    renderDetails('number', 'cart.size');

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('renders a not found state without requesting attributes when the type is invalid', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {},
    });

    renderDetails('constructor', 'cart.size');

    expect(await screen.findByText('Attribute not found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('hides the page when the feature is disabled', () => {
    const {organization: organizationWithoutFeature} = initializeOrg();
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {},
    });

    render(<ProjectAttributeDetails />, {
      organization: organizationWithoutFeature,
      outletContext: {project},
      initialRouterConfig: {
        location: {
          pathname: `/settings/projects/${project.slug}/attributes/string/cart.size/`,
        },
        route: '/settings/projects/:projectId/attributes/:attributeType/:attributeName/',
      },
    });

    expect(request).not.toHaveBeenCalled();
  });
});
