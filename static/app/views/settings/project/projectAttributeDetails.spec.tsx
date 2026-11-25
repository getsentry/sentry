import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

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
        context: {},
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

  it.each(['array', 'boolean'])(
    'hides the cardinality when the attribute is %s',
    async attributeType => {
      MockApiClient.addMockResponse({
        url: detailsEndpoint,
        body: {
          name: 'cache.hit',
          attributeType,
          attributeSource: {source_type: 'user'},
          datasets: ['spans'],
          context: {},
          lastSeen: '2017-10-15T02:41:20+00:00',
          stats: {spans: {lastSeen: '2017-10-15T02:41:20+00:00', cardinality: null}},
        },
      });

      renderDetails(attributeType, 'cache.hit');

      expect(await screen.findByText('2 days ago')).toBeInTheDocument();
      expect(screen.queryByText('Cardinality')).not.toBeInTheDocument();
    }
  );

  it('renders the raw unit when the unit has no label', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'payload_size',
        attributeType: 'number',
        attributeSource: {source_type: 'sentry'},
        datasets: ['logs'],
        lastSeen: null,
        stats: {logs: {lastSeen: null, cardinality: null}},
        context: {unit: 'kibibyte'},
      },
    });

    renderDetails('number', 'payload_size');

    expect(await screen.findByText('kibibyte')).toBeInTheDocument();
  });

  it('renders the description of a custom attribute when it has custom context', async () => {
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

    expect(await screen.findByText('Items in the cart.')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders the count of values modified by Relay when the attribute is in spans', async () => {
    MockApiClient.addMockResponse({
      url: detailsEndpoint,
      body: {
        name: 'http.url',
        attributeType: 'string',
        attributeSource: {source_type: 'user'},
        datasets: ['spans'],
        context: {},
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
      expect.objectContaining({query: expect.objectContaining({attributeSource: 'user'})})
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
    const request = MockApiClient.addMockResponse({url: detailsEndpoint, body: {}});

    renderDetails('constructor', 'cart.size');

    expect(await screen.findByText('Attribute not found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('hides the page when the feature is disabled', () => {
    const {organization: organizationWithoutFeature} = initializeOrg();
    const request = MockApiClient.addMockResponse({url: detailsEndpoint, body: {}});

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

  describe('editing', () => {
    const {organization: editingOrganization} = initializeOrg({
      organization: {
        access: [...OrganizationFixture().access, 'event:write'],
        features: ['attribute-management', 'data-browsing-attribute-context'],
      },
    });
    const editingDetailsEndpoint = `/organizations/${editingOrganization.slug}/trace-items/attributes/details/`;
    const contextEndpoint = `/organizations/${editingOrganization.slug}/trace-items/attributes/cart.size/context/`;
    const routerConfig = {
      location: {
        pathname: `/settings/projects/${project.slug}/attributes/number/cart.size/`,
      },
      route: '/settings/projects/:projectId/attributes/:attributeType/:attributeName/',
    };
    const customAttribute = {
      name: 'cart.size',
      attributeType: 'number',
      attributeSource: {source_type: 'user'},
      datasets: ['spans', 'logs'],
      isEditable: true,
      lastSeen: null,
      stats: {spans: {lastSeen: null, cardinality: null}},
      context: {},
    };

    it('saves the metadata for the project when a custom attribute is edited', async () => {
      MockApiClient.addMockResponse({url: editingDetailsEndpoint, body: customAttribute});
      const save = MockApiClient.addMockResponse({
        url: contextEndpoint,
        method: 'PUT',
        body: {
          contexts: [
            {
              brief: 'Items in the cart.',
              additionalContext: 'Counted at checkout.',
              examples: ['1', '3'],
            },
          ],
        },
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Description'}),
        'Items in the cart.'
      );
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Notes'}),
        'Counted at checkout.'
      );
      await userEvent.type(
        screen.getByRole('textbox', {name: 'Examples'}),
        ' 1 {enter}3{enter}1'
      );
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      expect(await screen.findByText('Items in the cart.')).toBeInTheDocument();
      expect(screen.getByText('Applies to this project only.')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Edit'})).toHaveFocus();
      expect(screen.getByText('Saved attribute metadata.')).toBeInTheDocument();
      expect(save).toHaveBeenCalledWith(
        contextEndpoint,
        expect.objectContaining({
          query: {project: project.id},
          data: {
            datasets: ['spans', 'logs'],
            attributeType: 'number',
            brief: 'Items in the cart.',
            additionalContext: 'Counted at checkout.',
            examples: ['1', '3'],
          },
        })
      );
    });

    it('focuses the description when editing starts', async () => {
      MockApiClient.addMockResponse({url: editingDetailsEndpoint, body: customAttribute});

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));

      expect(screen.getByRole('textbox', {name: 'Description'})).toHaveFocus();
    });

    it('closes without saving when only whitespace changed', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          context: {isCustom: true, brief: 'Items in the cart.'},
        },
      });
      const save = MockApiClient.addMockResponse({url: contextEndpoint, method: 'PUT'});

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), '  ');
      await userEvent.type(screen.getByRole('textbox', {name: 'Notes'}), '{enter} ');
      await userEvent.type(screen.getByRole('textbox', {name: 'Examples'}), '{enter} ');
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      expect(
        await screen.findByText('Applies to every project in this organization.')
      ).toBeInTheDocument();
      expect(save).not.toHaveBeenCalled();
    });

    it('keeps the saved examples when only the description changes', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          context: {isCustom: true, isProjectScoped: true, examples: ['3\n4', '5']},
        },
      });
      const save = MockApiClient.addMockResponse({
        url: contextEndpoint,
        method: 'PUT',
        body: {contexts: []},
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'Items');
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      expect(await screen.findByText('Saved attribute metadata.')).toBeInTheDocument();
      expect(save).toHaveBeenCalledWith(
        contextEndpoint,
        expect.objectContaining({
          data: expect.objectContaining({examples: ['3\n4', '5']}),
        })
      );
    });

    it('says changes apply to this project only while editing', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          context: {isCustom: true, brief: 'Items in the cart.'},
        },
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));

      expect(screen.getByText('Changes apply to this project only.')).toBeInTheDocument();
      expect(
        screen.queryByText('Applies to every project in this organization.')
      ).not.toBeInTheDocument();
    });

    it('shows the field error when the description is rejected', async () => {
      MockApiClient.addMockResponse({url: editingDetailsEndpoint, body: customAttribute});
      MockApiClient.addMockResponse({
        url: contextEndpoint,
        method: 'PUT',
        statusCode: 400,
        body: {brief: ['This description is not allowed.']},
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'Nope');
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      expect(await screen.findByRole('textbox', {name: 'Description'})).toHaveAttribute(
        'aria-invalid',
        'true'
      );
    });

    it('disables editing with a reason when the attribute is defined by Sentry', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          attributeSource: {source_type: 'sentry'},
          isEditable: false,
        },
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      const editButton = await screen.findByRole('button', {name: 'Edit'});
      await userEvent.hover(editButton);

      expect(editButton).toHaveAttribute('aria-disabled', 'true');
      expect(
        await screen.findByText("Sentry-defined attributes can't be edited.")
      ).toBeInTheDocument();
    });

    it('disables editing with a reason when the user cannot write events', async () => {
      const {organization: readOnlyOrganization} = initializeOrg({
        organization: {
          features: ['attribute-management', 'data-browsing-attribute-context'],
        },
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${readOnlyOrganization.slug}/trace-items/attributes/details/`,
        body: customAttribute,
      });

      render(<ProjectAttributeDetails />, {
        organization: readOnlyOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      const editButton = await screen.findByRole('button', {name: 'Edit'});
      await userEvent.hover(editButton);

      expect(editButton).toHaveAttribute('aria-disabled', 'true');
      expect(
        await screen.findByText("You don't have permission to edit attribute metadata.")
      ).toBeInTheDocument();
    });

    it('says the description applies to every project when it is organization-wide', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          context: {isCustom: true, brief: 'Items in the cart.'},
        },
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });

      expect(
        await screen.findByText('Applies to every project in this organization.')
      ).toBeInTheDocument();
    });

    it('hides editing when attribute context is disabled', async () => {
      MockApiClient.addMockResponse({url: detailsEndpoint, body: customAttribute});

      render(<ProjectAttributeDetails />, {
        organization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });

      expect(
        await screen.findByRole('heading', {level: 2, name: 'cart.size'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
    });

    it('discards changes and refocuses the edit button when editing is cancelled', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {
          ...customAttribute,
          context: {isCustom: true, brief: 'Items in the cart.'},
        },
      });
      const save = MockApiClient.addMockResponse({url: contextEndpoint, method: 'PUT'});

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), ' Edited');
      await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

      expect(screen.getByText('Items in the cart.')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Edit'})).toHaveFocus();
      expect(save).not.toHaveBeenCalled();
    });

    it('shows the error message when the save fails', async () => {
      MockApiClient.addMockResponse({url: editingDetailsEndpoint, body: customAttribute});
      MockApiClient.addMockResponse({
        url: contextEndpoint,
        method: 'PUT',
        statusCode: 400,
        body: {detail: 'Attribute `cart.size` was not found in logs.'},
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: routerConfig,
      });
      await userEvent.click(await screen.findByRole('button', {name: 'Edit'}));
      await userEvent.type(screen.getByRole('textbox', {name: 'Description'}), 'Items');
      await userEvent.click(screen.getByRole('button', {name: 'Save'}));

      expect(
        await screen.findByText('Attribute `cart.size` was not found in logs.')
      ).toBeInTheDocument();
    });

    it('disables editing with a reason when the attribute is an array', async () => {
      MockApiClient.addMockResponse({
        url: editingDetailsEndpoint,
        body: {...customAttribute, attributeType: 'array', isEditable: false},
      });

      render(<ProjectAttributeDetails />, {
        organization: editingOrganization,
        outletContext: {project},
        initialRouterConfig: {
          ...routerConfig,
          location: {
            pathname: `/settings/projects/${project.slug}/attributes/array/cart.size/`,
          },
        },
      });
      const editButton = await screen.findByRole('button', {name: 'Edit'});
      await userEvent.hover(editButton);

      expect(editButton).toHaveAttribute('aria-disabled', 'true');
      expect(
        await screen.findByText("Array attributes can't be edited.")
      ).toBeInTheDocument();
    });
  });
});
