import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';
import type {WorkflowEngineDebuggerResponse} from 'sentry/utils/workflowEngineDebuggerApiOptions';

import WorkflowEngine from 'admin/views/workflowEngine';

const endpoint = '/_admin/cells/us/workflow-engine/debugger/';
const configurationTitle = 'Configuration and Relationships';

function response(
  overrides: Partial<WorkflowEngineDebuggerResponse> = {}
): WorkflowEngineDebuggerResponse {
  return {
    item: {
      id: '7',
      name: 'Checkout workflow',
      type: 'workflow',
      organizationId: '1',
      projectId: null,
      context: {
        enabled: true,
        config: {environment: 'configuration-only-value'},
        triggers: null,
        actionFilters: [],
        detectors: [],
        contextTruncated: false,
      },
    },
    artifacts: [
      {
        itemId: 'artifact-7',
        projectId: '2',
        traceId: 'trace-7',
        timestamp: '2026-05-01T12:00:00Z',
        attributes: {evaluation_type: 'workflow', outcome: 'artifact-outcome'},
      },
    ],
    start: '2026-04-30T12:00:00Z',
    end: '2026-05-01T12:00:00Z',
    retentionDays: 7,
    truncated: false,
    ...overrides,
  };
}

async function search(id = '7') {
  const input = screen.getByRole('textbox', {name: /Item ID/});
  await userEvent.clear(input);
  await userEvent.type(input, id);
  await userEvent.click(screen.getByRole('button', {name: 'Search'}));
}

async function selectCell() {
  await selectEvent.select(screen.getByRole('textbox', {name: /Cell/}), 'us');
}

describe('WorkflowEngine', () => {
  beforeEach(() => {
    ConfigStore.set('cells', [{name: 'us', locality_url: 'https://us.test/api/0/'}]);
  });

  it('keeps configuration collapsed and lets users open, collapse, and reopen it', async () => {
    const request = MockApiClient.addMockResponse({url: endpoint, body: response()});
    render(<WorkflowEngine />);
    await selectCell();
    await search();

    expect(
      await screen.findByRole('heading', {name: 'Evaluation Artifacts (1)'})
    ).toBeInTheDocument();
    expect(screen.getByText('artifact-outcome')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Checkout workflow'})).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Evaluation artifacts found: 1.'
    );
    expect(screen.getByRole('status')).not.toHaveTextContent('artifact-outcome');
    expect(screen.queryByRole('region', {name: 'Config'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Workflow 7: Checkout workflow'})
    ).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        host: 'https://us.test/api/0/',
        query: {type: 'workflow', id: '7', statsPeriod: '24h'},
      })
    );

    const configuration = screen.getByRole('button', {name: configurationTitle});
    expect(configuration).toHaveAttribute('aria-expanded', 'false');
    configuration.focus();
    await userEvent.keyboard('{Enter}');
    expect(configuration).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(
      screen.getByRole('button', {name: 'Workflow 7: Checkout workflow'})
    );
    expect(screen.getByRole('region', {name: 'Config'})).toBeVisible();

    await userEvent.click(configuration);
    expect(configuration).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', {name: 'Config'})).not.toBeInTheDocument();
    expect(screen.getByText('artifact-outcome')).toBeVisible();
    await userEvent.click(configuration);
    expect(
      screen.getByRole('button', {name: 'Workflow 7: Checkout workflow'})
    ).toBeVisible();
  });

  it('resets configuration on another item and on a repeated lookup', async () => {
    MockApiClient.addMockResponse({url: endpoint, body: response()});
    render(<WorkflowEngine />);
    await selectCell();
    await search();
    await userEvent.click(await screen.findByRole('button', {name: configurationTitle}));

    const next = response();
    next.item = {...next.item, id: '8', name: 'Billing workflow'};
    MockApiClient.addMockResponse({url: endpoint, body: next});
    await search('8');
    expect(
      await screen.findByRole('heading', {name: 'Billing workflow'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: configurationTitle})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(
      screen.queryByRole('button', {name: 'Workflow 7: Checkout workflow'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: configurationTitle}));
    await search('8');
    expect(await screen.findByRole('button', {name: configurationTitle})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('searches events in their project and omits the project after switching item types', async () => {
    const eventId = '0123456789abcdef0123456789abcdef';
    const eventRequest = MockApiClient.addMockResponse({
      url: endpoint,
      body: response({
        item: {
          id: eventId,
          name: 'Checkout event',
          type: 'event',
          organizationId: '1',
          projectId: '2',
          context: {},
        },
        artifacts: [
          {
            itemId: 'event-artifact',
            projectId: '2',
            traceId: 'event-trace',
            timestamp: '2026-05-01T12:00:00Z',
            attributes: {
              evaluation_type: 'detector',
              outcome: 'event-matched-outcome',
            },
          },
        ],
      }),
    });
    render(<WorkflowEngine />);
    await selectCell();
    await selectEvent.select(screen.getByRole('textbox', {name: /Item type/}), 'Event');
    await userEvent.type(screen.getByRole('textbox', {name: /Project ID/}), ' 2 ');
    await search(eventId);

    expect(await screen.findByText('event-matched-outcome')).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Checkout event'})).toBeVisible();
    expect(eventRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        host: 'https://us.test/api/0/',
        query: {type: 'event', id: eventId, projectId: '2', statsPeriod: '24h'},
      })
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: /Item type/}),
      'Workflow'
    );
    expect(screen.queryByRole('textbox', {name: /Project ID/})).not.toBeInTheDocument();
    const workflowRequest = MockApiClient.addMockResponse({
      url: endpoint,
      body: response(),
    });
    await search();

    expect(await screen.findByRole('heading', {name: 'Checkout workflow'})).toBeVisible();
    expect(screen.getByText('artifact-outcome')).toBeVisible();
    expect(screen.queryByText('event-matched-outcome')).not.toBeInTheDocument();
    expect(workflowRequest).toHaveBeenCalledWith(
      endpoint,
      expect.objectContaining({
        host: 'https://us.test/api/0/',
        query: {type: 'workflow', id: '7', statsPeriod: '24h'},
      })
    );
  });

  it('keeps configuration inspectable when no artifacts exist and reports truncation', async () => {
    MockApiClient.addMockResponse({
      url: endpoint,
      body: response({artifacts: [], truncated: true}),
    });
    render(<WorkflowEngine />);
    await selectCell();
    await search();

    expect(await screen.findByText('No Artifacts Found')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Evaluation Artifacts (0)'})).toBeVisible();
    expect(screen.getByText(/Results are truncated/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', {name: configurationTitle}));
    await userEvent.click(
      screen.getByRole('button', {name: 'Workflow 7: Checkout workflow'})
    );
    expect(screen.getByRole('region', {name: 'Config'})).toBeVisible();
  });

  it.each([
    {
      statusCode: 403,
      message:
        'Access denied. Check your active superuser session and organization approval, then search again.',
    },
    {
      statusCode: 404,
      message: 'Lookup not found. Check the ID, selected cell, and backend environment.',
    },
    {
      statusCode: 500,
      message: 'Could not load evaluations. Check your connection and search again.',
    },
  ])(
    'removes previous privileged results after a $statusCode response',
    async ({statusCode, message}) => {
      MockApiClient.addMockResponse({url: endpoint, body: response()});
      render(<WorkflowEngine />);
      await selectCell();
      await search();
      await userEvent.click(
        await screen.findByRole('button', {name: configurationTitle})
      );
      await userEvent.click(
        screen.getByRole('button', {name: 'Workflow 7: Checkout workflow'})
      );
      expect(screen.getByRole('region', {name: 'Config'})).toBeVisible();

      MockApiClient.addMockResponse({
        url: endpoint,
        statusCode,
        body: {detail: 'Lookup unavailable'},
      });
      await search();
      expect(await screen.findByText(message)).toBeVisible();
      expect(screen.getByText('Lookup unavailable')).toBeVisible();
      expect(screen.queryByText('artifact-outcome')).not.toBeInTheDocument();
      expect(screen.queryByRole('region', {name: 'Config'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {name: 'Checkout workflow'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: configurationTitle})
      ).not.toBeInTheDocument();
    }
  );
});
