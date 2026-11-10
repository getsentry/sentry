import {OrganizationFixture} from 'sentry-fixture/organization';
import {PrebuiltClassifierFixture} from 'sentry-fixture/prebuiltClassifier';
import {ProjectFixture} from 'sentry-fixture/project';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import NewClassifier from './new';

const PREBUILT_CLASSIFIERS = [
  PrebuiltClassifierFixture(),
  PrebuiltClassifierFixture({
    key: 'tool_failure',
    name: 'Tool failure',
    description: 'When a tool fails.',
    resultAttribute: 'tool_failure',
  }),
];

describe('NewClassifier', () => {
  const organization = OrganizationFixture({features: ['classifiers-ui']});
  const path = `/organizations/${organization.slug}/seer/classifiers/new/`;
  const frontend = ProjectFixture({id: '1', slug: 'frontend', isMember: true});
  const backend = ProjectFixture({
    id: '2',
    slug: 'backend',
    isMember: true,
    environments: ['production'],
  });
  let conversationsMock: jest.Mock;

  function renderPage(query: Record<string, string | string[]> = {}) {
    return render(<NewClassifier />, {
      organization,
      initialRouterConfig: {
        location: {pathname: path, query: {dataset: 'conversation', ...query}},
        route: '/organizations/:orgId/seer/classifiers/new/',
      },
    });
  }

  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([frontend, backend]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/classifiers/prebuilt/`,
      body: PREBUILT_CLASSIFIERS,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {data: [], meta: {fields: {}, units: {}}},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/trace-items/attributes/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/recent-searches/`,
      body: [],
    });
    conversationsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
    });
  });

  it('shows a coming soon message for the spans dataset', async () => {
    renderPage({dataset: 'trace_spans'});

    expect(await screen.findByText('Coming soon')).toBeInTheDocument();
    expect(screen.queryByText('Filter classifier')).not.toBeInTheDocument();
  });

  it('keeps the project from the page filters', async () => {
    renderPage({project: '2'});

    expect(
      await screen.findByRole('button', {name: 'Project backend'})
    ).toBeInTheDocument();
  });

  it('narrows a multi-project selection to one project', async () => {
    renderPage({project: ['2', '1']});

    expect(
      await screen.findByRole('button', {name: 'Project backend'})
    ).toBeInTheDocument();
  });

  it('preselects a project sending agent data when none is selected', async () => {
    ProjectsStore.loadInitialData([
      frontend,
      {...backend, hasInsightsAgentMonitoring: true},
    ]);

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Project backend'})
    ).toBeInTheDocument();
  });

  it('only lets one project be selected and offers no way to clear it', async () => {
    renderPage({project: '1'});

    await userEvent.click(await screen.findByRole('button', {name: 'Project frontend'}));
    await userEvent.click(await screen.findByRole('option', {name: 'backend'}));

    expect(
      await screen.findByRole('button', {name: 'Project backend'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /clear/i})).not.toBeInTheDocument();
  });

  it('requires a prebuilt classifier before moving to the next step', async () => {
    renderPage({project: '1'});

    expect(await screen.findByRole('button', {name: 'Next'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.click(await screen.findByRole('radio', {name: /User frustration/}));

    expect(screen.getByRole('radio', {name: /User frustration/})).toBeChecked();
    expect(screen.getByRole('button', {name: 'Next'})).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('only fetches conversations once the preview is requested', async () => {
    renderPage({project: '1', query: 'conversation.errors:>0'});

    await userEvent.click(await screen.findByRole('button', {name: 'Preview'}));

    expect(
      await screen.findByRole('heading', {name: 'Matched conversations'})
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(conversationsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: [1],
            query: 'conversation.errors:>0',
            statsPeriod: '7d',
          }),
        })
      );
    });
    expect(conversationsMock).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', {name: 'Re-run preview'}));

    await waitFor(() => expect(conversationsMock).toHaveBeenCalledTimes(2));
  });

  it('does not fetch conversations before the preview is requested', async () => {
    renderPage({project: '1'});

    await screen.findByRole('radio', {name: /User frustration/});

    expect(conversationsMock).not.toHaveBeenCalled();
  });

  it('limits the preview to 10 conversations', async () => {
    renderPage({project: '1'});

    await userEvent.click(await screen.findByRole('button', {name: 'Preview'}));

    await waitFor(() => {
      expect(conversationsMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({per_page: 10}),
        })
      );
    });
  });

  it('does not paginate the preview', async () => {
    conversationsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
      headers: {
        Link:
          '<https://sentry.io/next/>; rel="previous"; results="false"; cursor="0:0:1", ' +
          '<https://sentry.io/next/>; rel="next"; results="true"; cursor="0:10:0"',
      },
    });

    renderPage({project: '1'});

    await userEvent.click(await screen.findByRole('button', {name: 'Preview'}));

    await waitFor(() => expect(conversationsMock).toHaveBeenCalled());
    expect(
      await screen.findByText(
        'Up to 10 conversations from the last 7 days that match these filters'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
  });

  it('stores the selected prebuilt classifier in the URL', async () => {
    const {router} = renderPage({project: '1'});

    await userEvent.click(await screen.findByRole('radio', {name: /Tool failure/}));

    await waitFor(() => {
      expect(router.location.query.prebuilt).toBe('tool_failure');
    });
  });

  it('restores the prebuilt classifier from the URL', async () => {
    renderPage({project: '1', prebuilt: 'tool_failure'});

    expect(await screen.findByRole('radio', {name: /Tool failure/})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(await screen.findByRole('textbox', {name: /Classifier title/})).toHaveValue(
      'Tool failure'
    );
    expect(screen.getByRole('textbox', {name: /Attribute name/})).toHaveValue(
      'tool_failure'
    );
  });

  it('ignores an unknown prebuilt classifier in the URL', async () => {
    renderPage({project: '1', prebuilt: 'unknown'});

    expect(await screen.findByRole('radio', {name: /Tool failure/})).not.toBeChecked();
    expect(screen.getByRole('button', {name: 'Next'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('creates the classifier and opens its detail page', async () => {
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/classifiers/`,
      method: 'POST',
      body: TelemetryClassifierFixture({id: '42'}),
    });

    const {router} = renderPage({
      project: '2',
      environment: 'production',
      agent: 'support',
      query: 'conversation.errors:>0',
    });

    await userEvent.click(await screen.findByRole('radio', {name: /User frustration/}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    const title = await screen.findByRole('textbox', {name: /Classifier title/});
    expect(title).toHaveValue('User frustration');
    expect(screen.getByRole('textbox', {name: /Attribute name/})).toHaveValue(
      'user_frustration'
    );

    await userEvent.clear(title);
    await userEvent.type(title, 'Frustrated users');
    await userEvent.click(screen.getByRole('button', {name: 'Create classifier'}));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          data: {
            dataset: 'conversation',
            filterQuery:
              '(environment:["production"] (gen_ai.agent.name:["support"] OR gen_ai.function_id:["support"])) and (conversation.errors:>0)',
            name: 'Frustrated users',
            prebuiltClassifierKey: 'user_frustration',
            project: 2,
            resultAttribute: 'user_frustration',
          },
        })
      );
    });
    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/seer/classifiers/42/`
      );
    });
  });

  it('shows the enrichment prefix next to the attribute name', async () => {
    renderPage({project: '1', prebuilt: 'tool_failure'});

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));
    await userEvent.click(await screen.findByText('sentry.enrichment.'));

    expect(screen.getByRole('textbox', {name: /Attribute name/})).toHaveFocus();
  });

  it('rejects attribute names with invalid characters', async () => {
    const createMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/classifiers/`,
      method: 'POST',
      body: TelemetryClassifierFixture({id: '42'}),
    });

    renderPage({project: '1', prebuilt: 'tool_failure'});

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    const attribute = await screen.findByRole('textbox', {name: /Attribute name/});
    await userEvent.clear(attribute);
    await userEvent.type(attribute, 'Tool Failure');
    await userEvent.click(screen.getByRole('button', {name: 'Create classifier'}));

    await waitFor(() => {
      expect(attribute).toHaveAttribute('aria-invalid', 'true');
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('keeps edits when going back and shows server errors on the field', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/classifiers/`,
      method: 'POST',
      statusCode: 400,
      body: {
        resultAttribute: ['Another classifier in this project uses this attribute.'],
      },
    });

    renderPage({project: '1'});

    await userEvent.click(await screen.findByRole('radio', {name: /Tool failure/}));
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    const title = await screen.findByRole('textbox', {name: /Classifier title/});
    await userEvent.type(title, ' v2');
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(await screen.findByRole('textbox', {name: /Classifier title/})).toHaveValue(
      'Tool failure v2'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Create classifier'}));

    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: /Attribute name/})).toHaveAttribute(
        'aria-invalid',
        'true'
      );
    });
  });
});
