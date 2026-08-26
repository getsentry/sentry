import {useEffect, type ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {
  AsyncSDKIntegrationContextProvider,
  useAsyncSDKIntegrationStore,
} from 'sentry/views/app/asyncSDKIntegrationProvider';
import {
  getInvestigationDetailQueryOptions,
  investigationExecutionDetailQueryOptions,
  investigationListQueryOptions,
} from 'sentry/views/investigations/api';
import InvestigationDetailView from 'sentry/views/investigations/detail';
import type {
  InvestigationBlock,
  InvestigationDetail,
} from 'sentry/views/investigations/types';

jest.unmock('@tanstack/react-pacer');

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';
const titleGenerationUrl =
  '/organizations/org-slug/investigations/investigation-1/title-generation/';

const feedbackForm = {
  appendToDom: jest.fn(),
  open: jest.fn(),
  close: jest.fn(),
  removeFromDom: jest.fn(),
};
const createFeedbackForm = jest.fn().mockResolvedValue(feedbackForm);
const feedbackIntegration = {
  createForm: createFeedbackForm,
} as unknown as FeedbackIntegration;

function FeedbackProvider({children}: {children: ReactNode}) {
  return (
    <AsyncSDKIntegrationContextProvider>
      <InstallFeedbackIntegration />
      <GlobalFeedbackForm>{children}</GlobalFeedbackForm>
    </AsyncSDKIntegrationContextProvider>
  );
}

function InstallFeedbackIntegration() {
  const {setState} = useAsyncSDKIntegrationStore();

  useEffect(() => {
    setState({Feedback: feedbackIntegration});
  }, [setState]);

  return null;
}

function InvestigationDetailFixture(
  overrides: Partial<InvestigationDetail> = {}
): InvestigationDetail & {blocks: InvestigationBlock[]} {
  return {
    id: 'investigation-1',
    title: 'Investigate database latency',
    status: 'active',
    sourceType: 'manual',
    createdBy: '1',
    dateCreated: '2026-08-13T20:00:00Z',
    dateUpdated: '2026-08-13T21:00:00Z',
    version: 1,
    blockCount: 2,
    isFavorited: false,
    summary: null,
    summaryDescription: null,
    blocks: [
      {
        id: 'block-1',
        position: 0,
        kind: 'text',
        title: 'Summary',
        content: 'Initial notes',
        generationPrompt: '',
        generatedContent: '',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {},
        display: {type: 'markdown'},
        dependencies: [],
        parameterKeys: [],
        version: 1,
        staleAt: null,
        createdBy: '1',
        lastEditedBy: '1',
      },
      {
        id: 'block-2',
        position: 1,
        kind: 'query',
        title: 'Latency query',
        content: '',
        generationPrompt: 'Find slow spans',
        generatedContent: '',
        output: null,
        outputStatus: 'notRun',
        currentExecution: null,
        config: {},
        display: {type: 'table'},
        dependencies: [],
        parameterKeys: [],
        version: 1,
        staleAt: null,
        createdBy: '1',
        lastEditedBy: '1',
      },
    ],
    filters: {},
    parameters: [],
    projectIds: [],
    source: {type: 'manual', ref: {}, revision: null},
    template: null,
    titleGeneration: {status: null},
    ...overrides,
  };
}

function renderView(
  renderOrganization = organization,
  queryClient = makeTestQueryClient(),
  withFeedback = false
) {
  const result = render(<InvestigationDetailView />, {
    additionalWrapper: ({children}) => (
      <QueryClientProvider client={queryClient}>
        {withFeedback ? <FeedbackProvider>{children}</FeedbackProvider> : children}
      </QueryClientProvider>
    ),
    organization: renderOrganization,
    initialRouterConfig: {
      location: {
        pathname: '/organizations/org-slug/seer/investigation/investigation-1/',
      },
      route: '/organizations/:orgId/seer/investigation/:investigationId/',
    },
  });

  return {...result, queryClient};
}

describe('Investigation detail', () => {
  beforeEach(() => {
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation();
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation();
    createFeedbackForm.mockClear();
  });

  it('loads and renders the complete investigation response', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Ask Seer about Summary'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Ask Seer about Latency query'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Ask Seer')).not.toBeInTheDocument();
    expect(screen.queryByText(/"blocks":/)).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('investigation-summary')).not.toBeInTheDocument();
  });

  it('opens feedback scoped to the investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        sourceType: 'metric_open_period',
        template: {key: 'breached_metric', version: 1},
      }),
    });

    renderView(organization, makeTestQueryClient(), true);

    await userEvent.click(await screen.findByRole('button', {name: 'Give feedback'}));

    await waitFor(() => {
      expect(createFeedbackForm).toHaveBeenCalledWith(
        expect.objectContaining({
          formTitle: 'Give feedback on this investigation',
          messagePlaceholder: 'What was useful, incorrect, or missing?',
          tags: {
            'feedback.source': 'investigation',
            'feedback.owner': 'ml-ai',
            'investigation.id': 'investigation-1',
            'investigation.source_type': 'metric_open_period',
            'investigation.template': 'breached_metric',
          },
        })
      );
    });
  });

  it('renders completed investigation metadata above the first block', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        summary: 'Errors rose across releases',
        summaryDescription:
          'All active releases increased together.\nCheck shared infrastructure and dependencies.',
      }),
    });

    renderView();

    const summary = await screen.findByTestId('investigation-summary');
    expect(within(summary).getByText('Current understanding')).toBeInTheDocument();
    expect(within(summary).getByText('Errors rose across releases')).toBeInTheDocument();
    expect(
      within(summary).getByText(/All active releases increased together/)
    ).toBeInTheDocument();
    expect(
      summary.compareDocumentPosition(screen.getByTestId('investigation-cell-block-1'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders partial text while an agent-written text cell is running', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks[0] = {
      ...investigation.blocks[0]!,
      outputStatus: 'running',
      currentExecution: {
        id: 'execution-1',
        status: 'running',
        startedAt: '2026-08-18T20:00:00Z',
        completedAt: null,
        error: null,
      },
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-1/executions/execution-1/`,
      body: {
        id: 'execution-1',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: 'Errors are concentrated in checkout.',
        error: null,
      },
    });

    renderView();

    expect(
      await screen.findByText('Errors are concentrated in checkout.')
    ).toBeInTheDocument();
  });

  it('does not render stale streamed text after a text cell completes', async () => {
    const queryClient = makeTestQueryClient();
    const investigation = InvestigationDetailFixture();
    investigation.blocks[0] = {
      ...investigation.blocks[0]!,
      outputStatus: 'available',
      output: {schemaVersion: 1, markdown: 'Final persisted analysis'},
      currentExecution: {
        id: 'execution-1',
        status: 'completed',
        startedAt: '2026-08-18T20:00:00Z',
        completedAt: '2026-08-18T20:01:00Z',
        error: null,
      },
    };
    const executionOptions = investigationExecutionDetailQueryOptions({
      organizationSlug: organization.slug,
      investigationId: investigation.id,
      blockId: 'block-1',
      executionId: 'execution-1',
    });
    queryClient.setQueryData(executionOptions.queryKey, {
      headers: {},
      json: {
        id: 'execution-1',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: 'Thinking…',
        error: null,
      },
    });
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView(organization, queryClient);

    expect(await screen.findByText('Final persisted analysis')).toBeInTheDocument();
    expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
  });

  it('renders the streamed investigation title preview', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Untitled investigation',
        titleGeneration: {status: 'running'},
      }),
    });
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'running', preview: 'Checkout error rate spike'},
    });

    renderView();

    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: 'Investigation title'})).toHaveValue(
        'Checkout error rate spike'
      )
    );
  });

  it('restores the generated preview after abandoning an empty title edit', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Untitled investigation',
        titleGeneration: {status: 'running'},
      }),
    });
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'running', preview: 'Checkout error rate spike'},
    });

    renderView();

    const titleInput = await screen.findByRole('textbox', {
      name: 'Investigation title',
    });
    await waitFor(() => expect(titleInput).toHaveValue('Checkout error rate spike'));
    await userEvent.clear(titleInput);
    fireEvent.blur(titleInput);

    await waitFor(() => expect(titleInput).toHaveValue('Checkout error rate spike'));
  });

  it('does not replace an investigation title that was renamed before mount', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Manually renamed investigation',
        titleGeneration: {status: 'running'},
      }),
    });
    const titleRequest = MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'running', preview: 'Generated title preview'},
    });

    renderView();

    await waitFor(() => expect(titleRequest).toHaveBeenCalled());
    expect(screen.getByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      'Manually renamed investigation'
    );
    expect(screen.queryByDisplayValue('Generated title preview')).not.toBeInTheDocument();
  });

  it('renders the persisted title when completion has no preview', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Untitled investigation',
        titleGeneration: {status: 'running'},
      }),
    });
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'running', preview: null},
    });

    renderView();
    expect(await screen.findByDisplayValue('Untitled investigation')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Mobile API Monitor False Alert',
        summary: 'Comparison logic triggered breach',
        summaryDescription: 'One event appeared against a zero-event baseline.',
        titleGeneration: {status: 'completed'},
      }),
    });
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'completed', preview: null},
    });

    await waitFor(
      () =>
        expect(screen.getByRole('textbox', {name: 'Investigation title'})).toHaveValue(
          'Mobile API Monitor False Alert'
        ),
      {timeout: 2000}
    );
    expect(screen.getByText('Comparison logic triggered breach')).toBeInTheDocument();
  });

  it('invalidates the investigations list when metadata generation settles', async () => {
    const queryClient = makeTestQueryClient();
    const listOptions = investigationListQueryOptions({
      organizationSlug: 'org-slug',
    });
    queryClient.setQueryData(listOptions.queryKey, {
      headers: {},
      json: [],
    });
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        title: 'Untitled investigation',
        titleGeneration: {status: 'running'},
      }),
    });
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'completed', preview: 'Checkout error rate spike'},
    });

    renderView(organization, queryClient);

    await waitFor(() =>
      expect(queryClient.getQueryState(listOptions.queryKey)?.isInvalidated).toBe(true)
    );
  });

  it('shows running and dependency-waiting states for auto-run cells', async () => {
    const investigation = InvestigationDetailFixture({
      template: {key: 'breached_metric', version: 1},
    });
    const textBlock = investigation.blocks[0]!;
    const queryBlock = investigation.blocks[1]!;
    investigation.blocks = [
      {
        ...textBlock,
        content: '',
        config: {autoRun: true},
        outputStatus: 'running',
        currentExecution: {
          id: 'execution-1',
          status: 'running',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: null,
          error: null,
        },
      },
      {
        ...queryBlock,
        config: {autoRun: true},
        outputStatus: 'pending',
        currentExecution: {
          id: 'execution-2',
          status: 'pending',
          startedAt: null,
          completedAt: null,
          error: null,
        },
      },
      {
        ...textBlock,
        id: 'block-3',
        position: 2,
        title: 'Synthesis',
        content: '',
        config: {autoRun: true},
        dependencies: ['block-1', 'block-2'],
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-1/executions/execution-1/`,
      body: {
        id: 'execution-1',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();

    expect(await screen.findAllByText('Seer is working on this cell…')).toHaveLength(2);
    expect(screen.getByText('Waiting for previous cells…')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Ask Seer about Synthesis'})).toBeDisabled();
  });

  it('keeps polling while an auto-run cell is waiting to start', async () => {
    const investigation = InvestigationDetailFixture({
      template: {key: 'breached_metric', version: 1},
    });
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        outputStatus: 'completed',
        currentExecution: {
          id: 'execution-completed',
          status: 'completed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: null,
        },
      },
      {
        ...investigation.blocks[1]!,
        config: {autoRun: true},
        dependencies: ['block-1'],
      },
    ];
    const request = MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByText('Waiting for previous cells…')).toBeInTheDocument();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2), {timeout: 3000});
  });

  it('shows a failed state when a cell has no output', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[1]!,
        outputStatus: 'failed',
        currentExecution: {
          id: 'execution-failed',
          status: 'failed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: {message: 'Query failed'},
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByTestId('cell-execution-failed')).toHaveTextContent(
      'Query failed'
    );
  });

  it('only blocks cells that depend on a failed branch', async () => {
    const investigation = InvestigationDetailFixture();
    const textBlock = investigation.blocks[0]!;
    const queryBlock = investigation.blocks[1]!;
    investigation.blocks = [
      {
        ...textBlock,
        outputStatus: 'failed',
        currentExecution: {
          id: 'execution-failed',
          status: 'failed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: {message: 'Summary failed'},
        },
      },
      {
        ...queryBlock,
        config: {autoRun: true},
        dependencies: ['block-1'],
      },
      {
        ...textBlock,
        id: 'block-3',
        position: 2,
        title: 'Independent analysis',
        outputStatus: 'completed',
        currentExecution: {
          id: 'execution-completed',
          status: 'completed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: null,
        },
      },
      {
        ...queryBlock,
        id: 'block-4',
        position: 3,
        title: 'Independent follow-up',
        config: {autoRun: true},
        dependencies: ['block-3'],
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(
      await screen.findByText('Cancelled because a previous cell failed.')
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting for previous cells…')).toBeInTheDocument();
    expect(
      screen.queryByTestId('investigation-execution-failed')
    ).not.toBeInTheDocument();
  });

  it('keeps the refinement composer expanded while editing', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Ask Seer about Latency query',
      })
    );

    const prompt = screen.getByLabelText('Instructions for Seer');
    expect(screen.getByText('Ask Seer to refine')).toBeInTheDocument();
    expect(prompt).toHaveValue('Find slow spans');
    expect(prompt).toBeVisible();
    expect(screen.queryByRole('button', {name: 'Ask Seer'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel Seer request'}));
    expect(screen.queryByLabelText('Instructions for Seer')).not.toBeInTheDocument();
  });

  it('renders block output instead of block content', async () => {
    const investigation = InvestigationDetailFixture();
    const firstBlock = investigation.blocks[0];
    if (!firstBlock) {
      throw new Error('Expected an investigation block fixture.');
    }
    investigation.blocks[0] = {
      ...firstBlock,
      content: 'Prompt-side content that should not render',
      generatedContent: 'Generated content that should not render',
      output: {schemaVersion: 1, markdown: 'Actual persisted block output'},
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByText('Actual persisted block output')).toBeInTheDocument();
    expect(
      screen.queryByText('Prompt-side content that should not render')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Generated content that should not render')
    ).not.toBeInTheDocument();
  });

  it('uses compact breadcrumbs and renders text and table results without prompt data', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        title: '',
        generationPrompt: 'Secret text-generation prompt',
        output: {schemaVersion: 1, markdown: 'Rendered **analysis**'},
      },
      {
        ...investigation.blocks[1]!,
        title: 'Database latency',
        generationPrompt: 'Secret query-generation prompt',
        output: {
          schemaVersion: 1,
          preferredView: 'table',
          tableMarkdown: '| p95 | count |\n| --- | --- |\n| 820ms | 12 |',
          chart: null,
          chartUnavailableReason: null,
          isEmpty: false,
          queryLinks: [],
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByText('Rendered')).toBeInTheDocument();
    expect(screen.queryByText('Investigation step 1')).not.toBeInTheDocument();
    expect(screen.getByTestId('text-cell-result')).toHaveAttribute(
      'data-cell-variant',
      'unbordered'
    );
    expect(screen.getByTestId('query-cell-result')).toHaveAttribute(
      'data-cell-variant',
      'bordered'
    );
    expect(screen.getByTestId('query-cell-header')).toContainElement(
      screen.getByRole('button', {name: 'Ask Seer about Database latency'})
    );
    expect(screen.getByTestId('investigation-cell-block-1')).toHaveAttribute(
      'data-has-divider',
      'false'
    );
    expect(screen.getByTestId('investigation-cell-block-2')).toHaveAttribute(
      'data-has-divider',
      'true'
    );
    expect(screen.getByText('820ms')).toBeInTheDocument();
    expect(screen.queryByText('Secret text-generation prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret query-generation prompt')).not.toBeInTheDocument();
    expect(screen.getByTestId('investigation-breadcrumbs')).toHaveAttribute(
      'data-text-size',
      'md'
    );

    expect(screen.getByTestId('query-cell-title')).toHaveTextContent('Database latency');
    expect(screen.queryByText('Evidence/Database latency')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId('query-cell-title'));
    expect(screen.queryByText('820ms')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Toggle Database latency'}));
    expect(screen.getByText('820ms')).toBeVisible();
  });

  it('renders the outer query title as non-editable text', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    renderView();
    expect(await screen.findByTestId('query-cell-title')).toHaveTextContent(
      'Latency query'
    );
    expect(
      screen.queryByLabelText('Cell title for Latency query')
    ).not.toBeInTheDocument();
  });

  it('renders a preferred chart and falls back to its table when unavailable', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[1]!,
        id: 'chart-block',
        output: {
          schemaVersion: 1,
          preferredView: 'chart',
          tableMarkdown: '| fallback |\n| --- |\n| table |',
          chartUnavailableReason: null,
          isEmpty: false,
          queryLinks: [],
          chart: {
            title: 'Latency over time',
            visualization: 'line',
            x_axis: 'time',
            y_axis_unit: 'duration',
            series: [
              {
                label: 'p95',
                data: [
                  {x: '2026-08-17T10:00:00Z', y: 400},
                  {x: '2026-08-17T10:05:00Z', y: 800},
                ],
              },
            ],
          },
        },
      },
      {
        ...investigation.blocks[1]!,
        id: 'fallback-block',
        title: 'Unavailable chart',
        output: {
          schemaVersion: 1,
          preferredView: 'chart',
          tableMarkdown: '| fallback |\n| --- |\n| shown |',
          chart: null,
          chartUnavailableReason: 'No numeric columns',
          isEmpty: false,
          queryLinks: [],
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
    expect(screen.getAllByTestId('query-cell-title')[0]).toHaveTextContent(
      'Latency query'
    );
    expect(screen.getByText('Latency over time')).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId('query-cell-header')[0]!).getByText(
        /Aug 17.*1,200 total p95/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('shown')).toBeInTheDocument();
  });

  it('renders chart metadata and reruns the query from the header', async () => {
    const investigation = InvestigationDetailFixture();
    const block = {
      ...investigation.blocks[1]!,
      outputStatus: 'completed' as const,
      output: {
        schemaVersion: 1,
        preferredView: 'chart',
        tableMarkdown: '| total |\n| ---: |\n| 363 |',
        chartUnavailableReason: null,
        isEmpty: false,
        queryLinks: [],
        chart: {
          title: 'Top Issues in spike window',
          subtitle: '3:57pm–4:12pm PST  |  363 Total Events',
          visualization: 'line',
          x_axis: 'time',
          y_axis_unit: 'number',
          series: [
            {
              label: 'Events',
              data: [
                {x: '2026-08-17T10:00:00Z', y: 120},
                {x: '2026-08-17T10:05:00Z', y: 243},
              ],
            },
          ],
        },
      },
    };
    investigation.blocks = [block];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const runUrl = `${detailUrl}blocks/${block.id}/executions/`;
    const rerunRequest = MockApiClient.addMockResponse({
      url: runUrl,
      method: 'POST',
      body: {id: 'rerun-1', status: 'running'},
    });
    MockApiClient.addMockResponse({
      url: `${runUrl}rerun-1/`,
      body: {
        id: 'rerun-1',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();
    const chartHeader = await screen.findByTestId('query-cell-header');
    expect(
      within(chartHeader).getByRole('heading', {
        name: 'Top Issues in spike window',
      })
    ).toBeInTheDocument();
    expect(
      within(chartHeader).getByText(/3:57pm–4:12pm PST\s+\|\s+363 Total Events/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Ask Seer about Latency query'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Cell actions for Latency query')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Rerun Latency query'}));
    await waitFor(() =>
      expect(rerunRequest).toHaveBeenCalledWith(
        runUrl,
        expect.objectContaining({
          data: {investigationVersion: 1, version: 1},
        })
      )
    );
  });

  it('deletes a query cell when it is no longer present in the cache', async () => {
    const investigation = InvestigationDetailFixture();
    const block = investigation.blocks[1]!;
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const deleteRequest = MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/${block.id}/`,
      method: 'DELETE',
    });

    renderView(organization, queryClient);
    await userEvent.click(await screen.findByLabelText('Cell actions for Latency query'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    expect(deleteRequest).not.toHaveBeenCalled();
    renderGlobalModal();
    act(() => {
      queryClient.setQueryData(options.queryKey, current =>
        current
          ? {
              ...current,
              json: {...current.json, blocks: undefined, version: 2},
            }
          : current
      );
    });
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(
        `${detailUrl}blocks/${block.id}/`,
        expect.objectContaining({
          data: {investigationVersion: 1, version: 1},
        })
      )
    );
    expect(screen.queryByDisplayValue('Latency query')).not.toBeInTheDocument();
  });

  it('adds text and query cells and starts a never-run cell from its stored prompt', async () => {
    const fixture = InvestigationDetailFixture();
    const textTemplate = fixture.blocks[0];
    const queryTemplate = fixture.blocks[1];
    if (!textTemplate || !queryTemplate) {
      throw new Error('Expected text and query block fixtures.');
    }
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({blocks: [], blockCount: 0}),
    });
    const blocksUrl = `${detailUrl}blocks/`;
    const textBlock = {
      ...textTemplate,
      id: 'text-block',
      title: 'Working theory',
      generationPrompt: 'Summarize the current evidence',
    };
    const textRequest = MockApiClient.addMockResponse({
      url: blocksUrl,
      method: 'POST',
      body: textBlock,
    });

    renderView();
    await userEvent.click(await screen.findByRole('button', {name: 'Text cell'}));
    await userEvent.type(screen.getByLabelText('Cell title'), 'Working theory');
    await userEvent.type(
      screen.getByLabelText('Cell instructions'),
      'Summarize the current evidence'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add cell'}));

    await waitFor(() =>
      expect(textRequest).toHaveBeenCalledWith(
        blocksUrl,
        expect.objectContaining({
          data: {
            investigationVersion: 1,
            kind: 'text',
            title: 'Working theory',
            generationPrompt: 'Summarize the current evidence',
          },
        })
      )
    );
    expect(
      await screen.findByRole('button', {
        name: 'Ask Seer about Working theory',
      })
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Working theory')).not.toBeInTheDocument();

    const queryBlock = {
      ...queryTemplate,
      id: 'query-block',
      title: 'Error volume',
      generationPrompt: 'Show errors over the last 24 hours',
    };
    const queryRequest = MockApiClient.addMockResponse({
      url: blocksUrl,
      method: 'POST',
      body: queryBlock,
    });
    await userEvent.click(screen.getByRole('button', {name: 'Query cell'}));
    await userEvent.type(screen.getByLabelText('Cell title'), 'Error volume');
    await userEvent.type(
      screen.getByLabelText('Cell instructions'),
      'Show errors over the last 24 hours'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Add cell'}));

    await waitFor(() =>
      expect(queryRequest).toHaveBeenCalledWith(
        blocksUrl,
        expect.objectContaining({
          data: {
            investigationVersion: 2,
            kind: 'query',
            title: 'Error volume',
            generationPrompt: 'Show errors over the last 24 hours',
          },
        })
      )
    );
    expect(
      (await screen.findAllByTestId('query-cell-title')).some(
        element => element.textContent === 'Error volume'
      )
    ).toBe(true);

    const updateUrl = `${blocksUrl}query-block/`;
    const updateRequest = MockApiClient.addMockResponse({
      url: updateUrl,
      method: 'PUT',
      body: queryBlock,
    });
    const runUrl = `${updateUrl}executions/`;
    const runRequest = MockApiClient.addMockResponse({
      url: runUrl,
      method: 'POST',
      body: {id: 'execution-1', status: 'running'},
    });
    MockApiClient.addMockResponse({
      url: `${runUrl}execution-1/`,
      body: {
        id: 'execution-1',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });
    await userEvent.click(
      screen.getByRole('button', {name: 'Ask Seer about Error volume'})
    );
    expect(screen.getByLabelText('Instructions for Seer')).toHaveValue(
      'Show errors over the last 24 hours'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        updateUrl,
        expect.objectContaining({
          data: {
            investigationVersion: 3,
            version: 1,
            generationPrompt: 'Show errors over the last 24 hours',
          },
        })
      )
    );

    await waitFor(() =>
      expect(runRequest).toHaveBeenCalledWith(
        runUrl,
        expect.objectContaining({
          data: {investigationVersion: 3, version: 1},
        })
      )
    );
  });

  it('keeps the previous result visible while showing a timed completed transcript', async () => {
    const investigation = InvestigationDetailFixture({version: 7});
    const block = investigation.blocks[0]!;
    investigation.blocks = [
      {
        ...block,
        version: 3,
        content: 'Previous successful result',
        outputStatus: 'completed',
        output: null,
        currentExecution: {
          id: 'execution-2',
          status: 'completed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: null,
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const blockUrl = `${detailUrl}blocks/block-1/`;
    const updateRequest = MockApiClient.addMockResponse({
      url: blockUrl,
      method: 'PUT',
      body: {...investigation.blocks[0]!, version: 4},
    });
    const runUrl = `${blockUrl}executions/`;
    const runRequest = MockApiClient.addMockResponse({
      url: runUrl,
      method: 'POST',
      body: {id: 'execution-2', status: 'running'},
    });
    MockApiClient.addMockResponse({
      url: `${runUrl}execution-2/`,
      body: {
        id: 'execution-2',
        status: 'completed',
        blocks: [
          {
            id: 'internal-prompt',
            timestamp: '2026-08-17T10:00:00Z',
            loading: false,
            message: {
              role: 'user',
              content:
                'Private agent instructions\n<investigation_context>{}</investigation_context>',
            },
            artifacts: [],
            toolLinks: null,
            toolResults: null,
          },
          {
            id: 'step-1',
            timestamp: '2026-08-17T10:00:00Z',
            loading: false,
            message: {role: 'user', content: 'Compare against deploys'},
            artifacts: [],
            toolLinks: null,
            toolResults: null,
          },
          {
            id: 'empty-code-mode-step-1',
            timestamp: '2026-08-17T10:00:02Z',
            loading: false,
            message: {
              role: 'tool_use',
              content: null,
              tool_calls: [{id: 'empty-1', function: 'sentry_api_execute', args: '{}'}],
            },
            artifacts: [],
            toolLinks: null,
            toolResults: [
              {
                tool_call_id: 'empty-1',
                tool_call_function: 'sentry_api_execute',
                content: '',
                structuredContent: {calls: []},
              },
            ],
          },
          {
            id: 'step-2',
            timestamp: '2026-08-17T10:00:04Z',
            loading: false,
            message: {role: 'assistant', content: 'The deploy lines up.'},
            artifacts: [],
            toolLinks: null,
            toolResults: null,
          },
          {
            id: 'empty-code-mode-step-2',
            timestamp: '2026-08-17T10:00:07Z',
            loading: false,
            message: {
              role: 'tool_use',
              content: null,
              tool_calls: [{id: 'empty-2', function: 'sentry_api_execute', args: '{}'}],
            },
            artifacts: [],
            toolLinks: null,
            toolResults: [
              {
                tool_call_id: 'empty-2',
                tool_call_function: 'sentry_api_execute',
                content: '',
                structuredContent: {calls: []},
              },
            ],
          },
        ],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();
    expect(await screen.findByText('Previous successful result')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Ask Seer about Summary'}));
    expect(screen.getByLabelText('Instructions for Seer')).toHaveValue('');
    const promptInput = screen.getByLabelText('Instructions for Seer');
    await userEvent.type(promptInput, 'Compare against deploys');
    fireEvent.keyDown(promptInput, {key: 'Enter'});

    await waitFor(() => expect(updateRequest).toHaveBeenCalledTimes(1));
    expect(updateRequest).toHaveBeenCalledWith(
      blockUrl,
      expect.objectContaining({
        data: {
          investigationVersion: 7,
          version: 3,
          generationPrompt: 'Compare against deploys',
        },
      })
    );
    await waitFor(() => expect(runRequest).toHaveBeenCalledTimes(1));
    expect(runRequest).toHaveBeenCalledWith(
      runUrl,
      expect.objectContaining({data: {investigationVersion: 8, version: 4}})
    );
    expect(screen.getByText('Previous successful result')).toBeInTheDocument();
    expect(await screen.findByText('Compare against deploys')).toBeInTheDocument();
    expect(screen.getByText('The deploy lines up.')).toBeInTheDocument();
    expect(screen.queryByText(/Private agent instructions/)).not.toBeInTheDocument();
    expect(screen.getByText('10.0s')).toBeInTheDocument();
    expect(screen.getByText('4.0s')).toBeInTheDocument();
    expect(screen.getByText('6.0s')).toBeInTheDocument();
    expect(screen.queryByText('2.0s')).not.toBeInTheDocument();
    expect(screen.queryByText('3.0s')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Ask Seer again'})).toBeInTheDocument();
    expect(screen.queryByLabelText('Instructions for Seer')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Ask Seer again'}));
    expect(screen.getByLabelText('Instructions for Seer')).toHaveValue('');
  });

  it('stops an active refinement and leaves the rendered result visible', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        outputStatus: 'completed',
        output: {schemaVersion: 1, markdown: 'Stable result'},
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const blockUrl = `${detailUrl}blocks/block-1/`;
    MockApiClient.addMockResponse({
      url: blockUrl,
      method: 'PUT',
      body: {...investigation.blocks[0]!, version: 2},
    });
    const runUrl = `${blockUrl}executions/`;
    MockApiClient.addMockResponse({
      url: runUrl,
      method: 'POST',
      body: {id: 'execution-running', status: 'running'},
    });
    MockApiClient.addMockResponse({
      url: `${runUrl}execution-running/`,
      body: {
        id: 'execution-running',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });
    const stopRequest = MockApiClient.addMockResponse({
      url: `${runUrl}execution-running/`,
      method: 'DELETE',
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('button', {name: 'Ask Seer about Summary'})
    );
    await userEvent.type(
      screen.getByLabelText('Instructions for Seer'),
      'Try another angle'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));
    await userEvent.click(await screen.findByRole('button', {name: 'Stop'}));

    await waitFor(() => expect(stopRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Stable result')).toBeInTheDocument();
  });

  it('answers a question while an execution is awaiting input', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        outputStatus: 'awaiting_input',
        currentExecution: {
          id: 'execution-awaiting-input',
          status: 'awaiting_input',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const executionUrl = `${detailUrl}blocks/block-1/executions/execution-awaiting-input/`;
    MockApiClient.addMockResponse({
      url: executionUrl,
      body: {
        id: 'execution-awaiting-input',
        status: 'awaiting_input',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: {
          id: 'input-1',
          input_type: 'ask_user_question',
          data: {
            questions: [
              {
                question: 'Which environment should I inspect?',
                options: [
                  {label: 'Production', description: 'Use production events'},
                  {label: 'Staging', description: 'Use staging events'},
                ],
              },
            ],
          },
        },
        partialMarkdown: null,
        error: null,
      },
    });
    const resumeRequest = MockApiClient.addMockResponse({
      url: executionUrl,
      method: 'PATCH',
    });

    renderView();
    await userEvent.click(
      await screen.findByRole('button', {name: 'Ask Seer about Summary'})
    );
    expect(
      await screen.findByText('Which environment should I inspect?')
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Submit'}));

    await waitFor(() =>
      expect(resumeRequest).toHaveBeenCalledWith(
        executionUrl,
        expect.objectContaining({
          data: {
            input_id: 'input-1',
            response_data: {answers: ['Production']},
          },
        })
      )
    );
  });

  it('reuses an investigation prefetched before the detail page mounts', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const queryClient = makeTestQueryClient();

    await queryClient.prefetchQuery(
      getInvestigationDetailQueryOptions('org-slug', 'investigation-1')
    );
    renderView(organization, queryClient);

    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('optimistically renames and debounces persistence', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const renameRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: InvestigationDetailFixture({
        title: 'Regional latency investigation',
        version: 2,
      }),
    });

    renderView();
    const titleInput = await screen.findByLabelText('Investigation title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Regional latency investigation');

    expect(titleInput).toHaveValue('Regional latency investigation');
    expect(renameRequest).not.toHaveBeenCalled();

    await waitFor(
      () =>
        expect(renameRequest).toHaveBeenCalledWith(
          detailUrl,
          expect.objectContaining({
            data: {
              title: 'Regional latency investigation',
              investigationVersion: 1,
            },
          })
        ),
      {timeout: 1500}
    );
  });

  it('preserves newer block state when a rename completes', async () => {
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    const investigation = InvestigationDetailFixture();
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-1/executions/execution-running/`,
      body: {
        id: 'execution-running',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });
    MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: () => {
        queryClient.setQueryData(options.queryKey, current =>
          current
            ? {
                ...current,
                json: {
                  ...current.json,
                  blocks: current.json.blocks?.map(block =>
                    block.id === 'block-1'
                      ? {
                          ...block,
                          outputStatus: 'running' as const,
                          currentExecution: {
                            id: 'execution-running',
                            status: 'running' as const,
                            startedAt: '2026-08-17T10:00:00Z',
                            completedAt: null,
                            error: null,
                          },
                        }
                      : block
                  ),
                  version: 3,
                },
              }
            : current
        );
        return InvestigationDetailFixture({
          title: 'Renamed investigation',
          version: 2,
        });
      },
    });

    renderView(organization, queryClient);
    const titleInput = await screen.findByLabelText('Investigation title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Renamed investigation');
    fireEvent.blur(titleInput);

    await waitFor(() =>
      expect(
        queryClient.getQueryData(options.queryKey)?.json.blocks?.[0]?.currentExecution?.id
      ).toBe('execution-running')
    );
    expect(queryClient.getQueryData(options.queryKey)?.json.version).toBe(3);
  });

  it('flushes a pending title change when the page unmounts', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const renameRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: InvestigationDetailFixture({title: 'Saved before leaving', version: 2}),
    });

    const {unmount} = renderView();
    const titleInput = await screen.findByLabelText('Investigation title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Saved before leaving');
    expect(renameRequest).not.toHaveBeenCalled();

    unmount();

    await waitFor(() =>
      expect(renameRequest).toHaveBeenCalledWith(
        detailUrl,
        expect.objectContaining({
          data: {title: 'Saved before leaving', investigationVersion: 1},
        })
      )
    );
  });

  it('polls for and displays a generated title after block execution finishes', async () => {
    let requestCount = 0;
    MockApiClient.addMockResponse({
      url: titleGenerationUrl,
      body: {status: 'completed', preview: null},
    });
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: () => {
        requestCount += 1;
        return requestCount === 1
          ? InvestigationDetailFixture({
              title: 'Untitled Investigation',
              titleGeneration: {status: 'running'},
            })
          : InvestigationDetailFixture({
              title: 'Generated latency investigation',
              titleGeneration: {status: 'completed'},
            });
      },
    });

    renderView();
    expect(await screen.findByDisplayValue('Untitled Investigation')).toBeInTheDocument();

    expect(
      await screen.findByDisplayValue('Generated latency investigation', undefined, {
        timeout: 3000,
      })
    ).toBeInTheDocument();
    expect(requestCount).toBeGreaterThan(1);
  });

  it('duplicates and opens the duplicate from the title menu', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}duplicate/`,
      method: 'POST',
      body: InvestigationDetailFixture({id: 'investigation-2'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/investigation-2/',
      body: InvestigationDetailFixture({id: 'investigation-2'}),
    });

    const {router} = renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Duplicate'}));

    await waitFor(() =>
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/seer/investigation/investigation-2/'
      )
    );
  });

  it('copies the link from the title menu', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {writeText},
      writable: true,
    });
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Copy link'}));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/organizations/org-slug/seer/investigation/investigation-1/`
      )
    );
  });

  it('deletes after confirmation and returns to the list', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'DELETE',
    });
    const renameRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      method: 'PUT',
      body: InvestigationDetailFixture({title: 'Pending rename', version: 2}),
    });

    const {router} = renderView();
    fireEvent.change(await screen.findByLabelText('Investigation title'), {
      target: {value: 'Pending rename'},
    });
    expect(renameRequest).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
    expect(deleteRequest).not.toHaveBeenCalled();
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(
        detailUrl,
        expect.objectContaining({data: {investigationVersion: 1}})
      )
    );
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/explore/investigations/'
    );
    await act(async () => new Promise(resolve => setTimeout(resolve, 600)));
    expect(renameRequest).not.toHaveBeenCalled();
  });

  it('renders the initial load error', async () => {
    MockApiClient.addMockResponse({url: detailUrl, statusCode: 500});

    renderView();

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });

  it('retains cached data when a background refetch fails', async () => {
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    queryClient.setQueryData(options.queryKey, {
      headers: {},
      json: InvestigationDetailFixture(),
    });
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      statusCode: 500,
    });

    renderView(organization, queryClient);
    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();

    await act(() => queryClient.invalidateQueries({queryKey: options.queryKey}));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();
    expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
  });

  it('does not bootstrap when the feature is disabled', () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView(OrganizationFixture({features: [], openMembership: true}));

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('does not bootstrap for a closed-membership organization', () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView(
      OrganizationFixture({
        features: ['investigations'],
        openMembership: false,
      })
    );

    expect(
      screen.getByText(
        'Investigations are only available to organizations with open membership.'
      )
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
