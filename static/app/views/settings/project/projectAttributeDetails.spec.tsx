import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

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
        context: {
          brief: 'The HTTP method, such as `HEAD`.',
          details: ['Uppercased by the SDK.\n\nSent on every request.'],
          examples: ['GET', 'POST'],
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
    expect(screen.getByText('Added by Sentry')).toBeInTheDocument();
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
        context: {isConvention: true},
      },
    });

    renderDetails('string', 'db.system');

    expect(await screen.findByText('Sentry convention')).toBeInTheDocument();
  });

  it('requests and renders the attribute when its name contains a slash', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http/route',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
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
