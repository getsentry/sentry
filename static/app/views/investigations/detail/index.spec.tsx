import {useEffect, useState, type ReactNode} from 'react';
import {QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

import * as indicators from 'sentry/actionCreators/indicator';
import type {FeedbackIntegration} from 'sentry/components/feedbackButton/useFeedbackSDKIntegration';
import {ConfigStore} from 'sentry/stores/configStore';
import {GlobalFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {
  AsyncSDKIntegrationContextProvider,
  useAsyncSDKIntegrationStore,
} from 'sentry/views/app/asyncSDKIntegrationProvider';
import {
  getInvestigationDetailQueryOptions,
  investigationExecutionDetailQueryOptions,
  investigationListQueryOptions,
  investigationOrchestrationQueryOptions,
} from 'sentry/views/investigations/api';
import InvestigationDetailView from 'sentry/views/investigations/detail';
import {
  InvestigationActionRequestFixture,
  InvestigationAgenticDetailFixture,
  InvestigationBlockFixture,
  InvestigationCommentFixture,
  InvestigationDetailFixture,
  InvestigationMetricSourceFixture,
  InvestigationOrchestrationFixture,
  InvestigationQueryOutputFixture,
} from 'sentry/views/investigations/fixtures';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';
import type {LLMContextNodeSnapshot} from 'sentry/views/seerExplorer/contexts/llmContextTypes';
import {
  SeerExplorerContext,
  useSeerExplorerContext,
  type SeerExplorerContextValue,
} from 'sentry/views/seerExplorer/useSeerExplorerContext';

jest.unmock('@tanstack/react-pacer');

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
// Where Seer Agent can take an "Ask Seer" question.
const askSeerOrganization = OrganizationFixture({
  features: ['investigations', 'seer-explorer', 'seer-explorer-chat-prompts'],
  hideAiFeatures: false,
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';
const titleGenerationUrl =
  '/organizations/org-slug/investigations/investigation-1/title-generation/';
const orchestrationUrl =
  '/organizations/org-slug/investigations/investigation-1/orchestration/';

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

/** Stands in for Seer Agent, which is what takes an "Ask Seer" question. */
function ChatPromptProvider({
  children,
  openChatPrompt,
}: {
  children: ReactNode;
  openChatPrompt: SeerExplorerContextValue['openChatPrompt'];
}) {
  const seerExplorer = useSeerExplorerContext();
  return (
    <SeerExplorerContext.Provider value={{...seerExplorer, openChatPrompt}}>
      {children}
    </SeerExplorerContext.Provider>
  );
}

function renderView(
  renderOrganization = organization,
  queryClient = makeTestQueryClient(),
  withFeedback = false,
  openChatPrompt?: SeerExplorerContextValue['openChatPrompt']
) {
  const result = render(<InvestigationDetailView />, {
    additionalWrapper: ({children}) => {
      const content = withFeedback ? (
        <FeedbackProvider>{children}</FeedbackProvider>
      ) : (
        children
      );
      return (
        <QueryClientProvider client={queryClient}>
          {openChatPrompt ? (
            <ChatPromptProvider openChatPrompt={openChatPrompt}>
              {content}
            </ChatPromptProvider>
          ) : (
            content
          )}
        </QueryClientProvider>
      );
    },
    organization: renderOrganization,
    initialRouterConfig: {
      location: {
        pathname: '/organizations/org-slug/seer/investigations/investigation-1/',
      },
      route: '/organizations/:orgId/seer/investigations/:investigationId/',
    },
  });

  return {...result, queryClient};
}

function investigationWithQueryResult() {
  const investigation = InvestigationDetailFixture();
  investigation.blocks[1] = {
    ...investigation.blocks[1]!,
    outputStatus: 'available',
    output: InvestigationQueryOutputFixture(),
  };
  return investigation;
}

function investigationWithReportHeadings() {
  return InvestigationDetailFixture({
    summary: 'Errors rose across releases',
    summaryDescription: 'All active releases increased together.',
    blocks: [
      InvestigationBlockFixture({
        id: 'what-happened',
        title: 'What happened',
        outputStatus: 'completed',
        output: {schemaVersion: 1, markdown: '## What happened\n\nErrors rose.'},
      }),
      InvestigationBlockFixture({
        id: 'deploy-timing',
        position: 1,
        title: 'Deploy timing',
        outputStatus: 'completed',
        output: {
          schemaVersion: 1,
          markdown: '## When it happened\n\nRight after the deploy.',
        },
      }),
    ],
  });
}

async function chooseBlockAction(
  blockTitle: string,
  action: 'Ask Seer' | 'Delete' | 'Show Seer activity'
) {
  await userEvent.click(
    await screen.findByRole('button', {name: `Block actions for ${blockTitle}`})
  );
  await userEvent.click(await screen.findByRole('menuitemradio', {name: action}));
}

describe('Investigation detail', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    jest.spyOn(indicators, 'addSuccessMessage').mockImplementation();
    jest.spyOn(indicators, 'addErrorMessage').mockImplementation();
    createFeedbackForm.mockClear();
    ConfigStore.set('customerDomain', null);
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
    MockApiClient.addMockResponse({url: `${detailUrl}comments/`, body: []});
    for (const id of ['312', '320', '322']) {
      MockApiClient.addMockResponse({
        url: `${detailUrl}action-requests/${id}/apply/`,
        method: 'POST',
        body: {actionRequest: InvestigationActionRequestFixture({id})},
      });
    }
  });

  it('loads and renders the complete investigation response', async () => {
    const request = MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });

    renderView();

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    expect(screen.getByLabelText('Block actions for Summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Block actions for Latency query')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Ask Seer about/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Rerun/})).not.toBeInTheDocument();
    expect(screen.queryByText(/"blocks":/)).not.toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('investigation-summary')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Block actions for Summary'));
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Rerun'})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Refine'})).not.toBeInTheDocument();
    // Without Seer Agent there is nothing to take the question.
    expect(
      screen.queryByRole('menuitemradio', {name: 'Ask Seer'})
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByLabelText('Block actions for Latency query'));
    expect(screen.queryByRole('menuitemradio', {name: 'Rerun'})).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitemradio', {name: 'Refine'})).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByLabelText('Investigation actions'));
    expect(screen.getByRole('menuitemradio', {name: 'Duplicate'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'Ask Seer'})
    ).not.toBeInTheDocument();
  });

  it('opens feedback scoped to the investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        sourceType: 'metric_open_period',
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
          },
        })
      );
    });
  });

  it('links a breached metric investigation to its issue by monitor name', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        sourceType: 'metric_open_period',
        source: InvestigationMetricSourceFixture(),
      }),
    });

    renderView();

    expect(
      await screen.findByRole('link', {name: 'Checkout error rate'})
    ).toHaveAttribute('href', '/organizations/org-slug/issues/123/');
  });

  it('links the issue of a breached metric investigation without a snapshot', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        sourceType: 'metric_open_period',
        source: {
          type: 'metric_open_period',
          ref: {groupId: '123', openPeriodId: '456'},
          revision: null,
        },
      }),
    });

    renderView();

    expect(await screen.findByRole('link', {name: 'View issue'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/123/'
    );
  });

  it('labels a manual investigation without a source link', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();

    expect(await screen.findByText('Manual investigation')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'View issue'})).not.toBeInTheDocument();
  });

  it('renders the summary as one paragraph above the investigation details', async () => {
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
    expect(
      within(summary).getByRole('heading', {level: 2, name: 'Summary'})
    ).toBeInTheDocument();
    expect(
      within(summary).getByText(
        'Errors rose across releases. All active releases increased together. Check shared infrastructure and dependencies.'
      )
    ).toBeInTheDocument();
    const details = screen.getByRole('heading', {
      level: 2,
      name: 'Investigation details',
    });
    expect(summary.compareDocumentPosition(details)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    expect(
      details.compareDocumentPosition(screen.getByTestId('investigation-block-block-1'))
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('renders the suggested next step between the summary and the details', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        summary: 'Errors rose across releases',
        summaryDescription: 'All active releases increased together.',
        actionRequests: [InvestigationActionRequestFixture()],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({phase: 'completed', status: 'completed'}),
    });

    renderView();

    const nextStep = await screen.findByRole('region', {
      name: 'Recommended action',
    });
    expect(
      screen.getByTestId('investigation-summary').compareDocumentPosition(nextStep)
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      nextStep.compareDocumentPosition(
        screen.getByRole('heading', {level: 2, name: 'Investigation details'})
      )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  describe('while Seer re-checks a stale suggestion', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        // Unmount first: a running run's status block keeps a live clock, and
        // flushing the query cache's timers with it mounted ticks it for minutes.
        cleanup();
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    function investigationWith(
      status: 'accepted' | 'acknowledged',
      runStatus: 'completed' | 'processing' = 'completed'
    ) {
      return InvestigationAgenticDetailFixture({
        blocks: [],
        orchestration: {
          phase: runStatus === 'completed' ? 'completed' : 'metadata',
          status: runStatus,
          heartbeatAt: null,
          notebookRevision: 5,
        },
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'superseded',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            error: {code: 'stale', current: {timeWindowSeconds: 600}},
            followUp: {status, reason: null, rerun: null, retryable: false},
          }),
        ],
      });
    }

    it('reads the investigation until Seer picks up the re-check', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('accepted'),
      });
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'completed',
          status: 'completed',
        }),
      });
      renderView();

      expect(
        await screen.findByText(/Seer is checking the suggestion again…/)
      ).toBeInTheDocument();

      const acknowledged = MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('acknowledged'),
      });
      await act(() => jest.advanceTimersByTimeAsync(2000));

      expect(acknowledged).toHaveBeenCalled();
      await waitFor(() =>
        expect(
          screen.queryByText(/Seer is checking the suggestion again/)
        ).not.toBeInTheDocument()
      );
      const later = MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('acknowledged'),
      });
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(later).not.toHaveBeenCalled();
    });

    it('reads the run again while Seer works on the re-check', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('acknowledged', 'processing'),
      });
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'completed',
          status: 'completed',
        }),
      });
      renderView();
      expect(
        await screen.findByText(/Ask Seer about this investigation/)
      ).toBeInTheDocument();

      const processing = MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'metadata',
          status: 'processing',
        }),
      });
      await act(() => jest.advanceTimersByTimeAsync(2000));

      expect(processing).toHaveBeenCalled();
      expect(
        await screen.findByText(/Seer is updating its suggestion…/)
      ).toBeInTheDocument();
    });

    const completedRun = InvestigationOrchestrationFixture({
      phase: 'completed',
      status: 'completed',
    });
    const processingRun = InvestigationOrchestrationFixture({
      phase: 'metadata',
      status: 'processing',
    });

    async function acknowledgeRecheck(
      body: ReturnType<typeof investigationWith> = investigationWith('acknowledged')
    ) {
      MockApiClient.addMockResponse({url: detailUrl, body});
      await act(() => jest.advanceTimersByTimeAsync(2000));
      await waitFor(() =>
        expect(
          screen.queryByText(/Seer is checking the suggestion again/)
        ).not.toBeInTheDocument()
      );
    }

    it('reads the run until it shows up after Seer picks up the re-check', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('accepted'),
      });
      MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
      renderView();
      expect(
        await screen.findByText(/Seer is checking the suggestion again…/)
      ).toBeInTheDocument();
      await acknowledgeRecheck();
      expect(screen.getByText(/Seer is updating its suggestion…/)).toBeInTheDocument();
      expect(
        screen.queryByText(/Ask Seer about this investigation/)
      ).not.toBeInTheDocument();

      const notLive = MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: completedRun,
      });
      await act(() => jest.advanceTimersByTimeAsync(4000));
      expect(notLive).toHaveBeenCalled();

      MockApiClient.addMockResponse({url: orchestrationUrl, body: processingRun});
      await act(() => jest.advanceTimersByTimeAsync(2000));

      expect(
        await screen.findByText(/Seer is updating its suggestion…/)
      ).toBeInTheDocument();
    });

    it('stops reading the run if the re-check never shows up', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('accepted'),
      });
      MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
      renderView();
      expect(
        await screen.findByText(/Seer is checking the suggestion again…/)
      ).toBeInTheDocument();
      await acknowledgeRecheck();

      await act(() => jest.advanceTimersByTimeAsync(60_000));
      expect(
        await screen.findByText(/Ask Seer about this investigation/)
      ).toBeInTheDocument();
      const later = MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: completedRun,
      });
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(later).not.toHaveBeenCalled();
    });

    it('does not wait on a re-check that was over before the page opened', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWith('acknowledged'),
      });
      MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
      renderView();
      expect(
        await screen.findByText(/Ask Seer about this investigation/)
      ).toBeInTheDocument();

      const later = MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: completedRun,
      });
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(later).not.toHaveBeenCalled();
    });

    it('waits on the newest re-check next to an old one', async () => {
      function withOldRecheck(status: 'accepted' | 'acknowledged') {
        const body = investigationWith(status);
        const requests = body.actionRequests ?? [];
        return {
          ...body,
          actionRequests: [
            InvestigationActionRequestFixture({
              ...requests[0],
              id: '310',
              followUp: {
                status: 'acknowledged',
                reason: null,
                rerun: null,
                retryable: false,
              },
            }),
            ...requests,
          ],
        };
      }
      MockApiClient.addMockResponse({url: detailUrl, body: withOldRecheck('accepted')});
      MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
      renderView();
      expect(
        await screen.findByText(/Seer is checking the suggestion again…/)
      ).toBeInTheDocument();
      await act(() => jest.advanceTimersByTimeAsync(60_000));
      await acknowledgeRecheck(withOldRecheck('acknowledged'));

      MockApiClient.addMockResponse({url: orchestrationUrl, body: processingRun});
      await act(() => jest.advanceTimersByTimeAsync(2000));

      expect(
        await screen.findByText(/Seer is updating its suggestion…/)
      ).toBeInTheDocument();
    });
  });

  it('waits for the re-check after a stale suggestion is rechecked', async () => {
    const staleBody = {
      code: 'stale',
      detail: 'This changed since Seer suggested it.',
      current: {timeWindowSeconds: 600},
    };
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        actionRequests: [InvestigationActionRequestFixture()],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({phase: 'completed', status: 'completed'}),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}action-requests/312/apply/`,
      method: 'POST',
      statusCode: 409,
      match: [MockApiClient.matchData({dryRun: true})],
      body: staleBody,
    });
    const rechecked = InvestigationActionRequestFixture({
      state: 'superseded',
      canApply: false,
      cannotApplyReason: 'not_suggested',
      error: {code: 'stale', current: {timeWindowSeconds: 600}},
      followUp: {status: 'accepted', reason: null, rerun: null, retryable: false},
    });
    const recheckRequest = MockApiClient.addMockResponse({
      url: `${detailUrl}action-requests/312/recheck/`,
      method: 'POST',
      body: {actionRequest: rechecked},
    });
    renderView();

    const recheck = await screen.findByRole('button', {name: 'Recheck suggestion'});
    await waitFor(() => expect(recheck).toBeEnabled());
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({actionRequests: [rechecked]}),
    });
    await userEvent.click(recheck);

    expect(recheckRequest).toHaveBeenCalledTimes(1);
    expect(
      await screen.findByText(/Seer is checking the suggestion again…/)
    ).toBeInTheDocument();
    expect(screen.getByText('Now: 10 minutes')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Recheck suggestion'})
    ).not.toBeInTheDocument();
  });

  it('shows a stale apply once the investigation is read again', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        actionRequests: [InvestigationActionRequestFixture()],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({phase: 'completed', status: 'completed'}),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}action-requests/312/apply/`,
      method: 'POST',
      statusCode: 409,
      match: [(_url, options) => !options.data?.dryRun],
      body: {
        code: 'stale',
        detail: 'This changed since Seer suggested it.',
        current: {timeWindowSeconds: 600},
      },
    });
    renderView();

    const button = await screen.findByRole('button', {name: 'Update monitor'});
    await waitFor(() => expect(button).toBeEnabled());
    let finishDetail!: () => void;
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        actionRequests: [
          InvestigationActionRequestFixture({
            state: 'superseded',
            canApply: false,
            cannotApplyReason: 'not_suggested',
            error: {code: 'stale', current: {timeWindowSeconds: 600}},
            followUp: {status: 'accepted', reason: null, rerun: null, retryable: false},
          }),
        ],
      }),
      asyncDelay: new Promise<void>(resolve => {
        finishDetail = resolve;
      }),
    });
    await userEvent.click(button);

    expect(await screen.findByRole('button', {name: 'Updating monitor…'})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Recheck suggestion'})
    ).not.toBeInTheDocument();
    act(() => finishDetail());

    expect(
      await screen.findByText(/Seer is checking the suggestion again…/)
    ).toBeInTheDocument();
    expect(screen.getByText('Now: 10 minutes')).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', {name: 'Recommended action'})).getAllByText(
        /The monitor changed since Seer suggested this/
      )
    ).toHaveLength(1);
    expect(
      screen.queryByRole('button', {name: /Update monitor|Recheck suggestion/})
    ).not.toBeInTheDocument();
  });

  it('says a stale apply failed when the investigation leaves the request out', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        actionRequests: [InvestigationActionRequestFixture()],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({phase: 'completed', status: 'completed'}),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}action-requests/312/apply/`,
      method: 'POST',
      statusCode: 409,
      match: [(_url, options) => !options.data?.dryRun],
      body: {
        code: 'stale',
        detail: 'This changed since Seer suggested it.',
        current: {timeWindowSeconds: 600},
      },
    });
    renderView();

    const button = await screen.findByRole('button', {name: 'Update monitor'});
    await waitFor(() => expect(button).toBeEnabled());
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({actionRequests: []}),
    });
    await userEvent.click(button);

    expect(
      await screen.findByText('The monitor changed since Seer suggested this.')
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('region', {name: 'Recommended action'})
      ).not.toBeInTheDocument()
    );
  });

  it('holds the next step placeholder until the investigation has its request', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: {
          phase: 'metadata',
          status: 'processing',
          heartbeatAt: '2026-08-27T11:06:30Z',
          notebookRevision: 5,
        },
        actionRequests: [],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'metadata',
        status: 'processing',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'generating', error: null},
        },
      }),
    });

    const {queryClient} = renderView();

    expect(
      await screen.findByRole('region', {name: 'Recommended action'})
    ).toHaveAttribute('aria-busy', 'true');

    let finishDetails!: () => void;
    const detailsResponse = new Promise<void>(resolve => {
      finishDetails = resolve;
    });
    const detailsRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: {
          phase: 'completed',
          status: 'completed',
          heartbeatAt: '2026-08-27T11:07:30Z',
          notebookRevision: 6,
        },
        actionRequests: [InvestigationActionRequestFixture()],
      }),
      asyncDelay: detailsResponse,
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'completed',
        status: 'completed',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'completed', error: null},
        },
      }),
    });
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          'investigation-1'
        ).queryKey,
      })
    );

    await waitFor(() => expect(detailsRequest).toHaveBeenCalled());
    expect(screen.getByRole('region', {name: 'Recommended action'})).toHaveAttribute(
      'aria-busy',
      'true'
    );

    await act(async () => {
      finishDetails();
      await detailsResponse;
    });

    expect(await screen.findByText(/Widen the interval/)).toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Recommended action'})).not.toHaveAttribute(
      'aria-busy'
    );
  });

  it('refetches the investigation when the first next step is ahead of it', async () => {
    const finishedRun = {
      phase: 'completed',
      status: 'completed',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
    } as const;
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: finishedRun,
        actionRequests: [],
      }),
    });
    let finishOrchestration!: () => void;
    const orchestrationResponse = new Promise<void>(resolve => {
      finishOrchestration = resolve;
    });
    const orchestrationRequest = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'completed',
        status: 'completed',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'completed', error: null},
        },
      }),
      asyncDelay: orchestrationResponse,
    });

    renderView();

    await waitFor(() => expect(orchestrationRequest).toHaveBeenCalled());
    let finishDetails!: () => void;
    const detailsResponse = new Promise<void>(resolve => {
      finishDetails = resolve;
    });
    const detailsRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: finishedRun,
        actionRequests: [InvestigationActionRequestFixture()],
      }),
      asyncDelay: detailsResponse,
    });
    await act(async () => {
      finishOrchestration();
      await orchestrationResponse;
    });

    await waitFor(() => expect(detailsRequest).toHaveBeenCalled());
    expect(screen.getByRole('region', {name: 'Recommended action'})).toHaveAttribute(
      'aria-busy',
      'true'
    );

    await act(async () => {
      finishDetails();
      await detailsResponse;
    });

    expect(await screen.findByText(/Widen the interval/)).toBeInTheDocument();
  });

  it('drops the next step placeholder when Seer suggests nothing', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: {
          phase: 'completed',
          status: 'completed',
          heartbeatAt: '2026-08-27T11:06:30Z',
          notebookRevision: 5,
        },
        actionRequests: [],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'metadata',
        status: 'processing',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'generating', error: null},
        },
      }),
    });

    const {queryClient} = renderView();

    expect(
      await screen.findByRole('region', {name: 'Recommended action'})
    ).toHaveAttribute('aria-busy', 'true');

    const detailsRequest = MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: {
          phase: 'completed',
          status: 'completed',
          heartbeatAt: '2026-08-27T11:07:30Z',
          notebookRevision: 6,
        },
        actionRequests: [],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'completed',
        status: 'completed',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'completed', error: null},
        },
      }),
    });
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          'investigation-1'
        ).queryKey,
      })
    );

    await waitFor(() => expect(detailsRequest).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.queryByRole('region', {name: 'Recommended action'})
      ).not.toBeInTheDocument()
    );
  });

  it('shows the new recommended action after a finished run writes a new report', async () => {
    const finishedRun = {
      phase: 'completed',
      status: 'completed',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
    } as const;
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: finishedRun,
        actionRequests: [InvestigationActionRequestFixture()],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'completed',
        status: 'completed',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          nextStep: {status: 'completed', error: null},
        },
      }),
    });

    const {queryClient} = renderView();

    expect(
      await screen.findByRole('region', {name: 'Recommended action'})
    ).toHaveTextContent('Widen the interval.');

    // Accepting a hypothesis made Seer write report 3, then suggest a new next step.
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        orchestration: finishedRun,
        actionRequests: [
          InvestigationActionRequestFixture({state: 'superseded'}),
          InvestigationActionRequestFixture({
            id: '320',
            key: 'raise-threshold',
            reportRevision: 3,
            title: 'Raise the threshold',
          }),
        ],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        phase: 'completed',
        status: 'completed',
        report: {
          ...InvestigationOrchestrationFixture().report,
          status: 'completed',
          revision: 3,
          nextStep: {status: 'completed', error: null},
        },
      }),
    });
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          'investigation-1'
        ).queryKey,
      })
    );

    expect(await screen.findByText(/Raise the threshold/)).toBeInTheDocument();
    expect(
      screen.getByRole('region', {name: 'Recommended action'})
    ).not.toHaveTextContent('Widen the interval');
  });

  describe('a connect suggestion when the window gets focus', () => {
    const connectSuggestion = InvestigationActionRequestFixture({
      title: 'Connect Datadog',
      impact: null,
      action: {kind: 'connect_telemetry', provider: 'datadog'},
    });

    function mockDetail(actionRequests: InvestigationActionRequest[]) {
      return MockApiClient.addMockResponse({
        url: detailUrl,
        body: InvestigationAgenticDetailFixture({
          blocks: [],
          orchestration: {
            phase: 'completed',
            status: 'completed',
            heartbeatAt: null,
            notebookRevision: 5,
          },
          actionRequests,
        }),
      });
    }

    async function focusWindow() {
      act(() => {
        window.dispatchEvent(new Event('visibilitychange'));
      });
      await act(() => Promise.resolve());
    }

    function mockConnectionCheck(connected: boolean) {
      return MockApiClient.addMockResponse({
        url: `${detailUrl}action-requests/312/apply/`,
        method: 'POST',
        match: [MockApiClient.matchData({dryRun: true})],
        ...(connected
          ? {body: {actionRequest: connectSuggestion}}
          : {
              statusCode: 400,
              body: {
                detail: "The change wasn't valid.",
                code: 'validation_failed',
                messages: ["This provider isn't connected yet."],
              },
            }),
      });
    }

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'completed',
          status: 'completed',
        }),
      });
      mockConnectionCheck(false);
    });

    it('offers a re-run once the provider is connected in another tab', async () => {
      mockDetail([connectSuggestion]);
      renderView();
      expect(
        await screen.findByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
      ).toBeInTheDocument();

      const reloaded = mockDetail([connectSuggestion]);
      const check = mockConnectionCheck(true);
      await focusWindow();

      expect(reloaded).toHaveBeenCalled();
      expect(check).toHaveBeenCalled();
      expect(
        await screen.findByRole('button', {name: 'Re-run with Datadog'})
      ).toBeEnabled();
    });

    it('shows the provider as connected once Sentry applies it', async () => {
      mockDetail([connectSuggestion]);
      renderView();
      expect(
        await screen.findByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
      ).toBeInTheDocument();

      const reloaded = mockDetail([
        {
          ...connectSuggestion,
          state: 'applied',
          canApply: false,
          cannotApplyReason: 'not_suggested',
        },
      ]);
      await focusWindow();

      expect(reloaded).toHaveBeenCalled();
      expect(
        await screen.findByRole('button', {name: 'View integration (opens in a new tab)'})
      ).toBeInTheDocument();
    });

    it('does not reload one the viewer cannot apply', async () => {
      mockDetail([
        {...connectSuggestion, canApply: false, cannotApplyReason: 'permission_denied'},
      ]);
      renderView();
      expect(
        await screen.findByRole('button', {name: 'Connect Datadog (opens in a new tab)'})
      ).toBeInTheDocument();

      const reloaded = mockDetail([connectSuggestion]);
      await focusWindow();

      expect(reloaded).not.toHaveBeenCalled();
    });

    it('does not reload without a connect suggestion', async () => {
      mockDetail([InvestigationActionRequestFixture()]);
      renderView();
      expect(
        await screen.findByRole('button', {name: 'Update monitor'})
      ).toBeInTheDocument();

      const reloaded = mockDetail([InvestigationActionRequestFixture()]);
      await focusWindow();

      expect(reloaded).not.toHaveBeenCalled();
    });
  });

  describe('action requests about part of the report', () => {
    const completedRun = InvestigationOrchestrationFixture({
      phase: 'completed',
      status: 'completed',
    });

    function mockAnchoredPage(actionRequests: InvestigationActionRequest[]) {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: InvestigationAgenticDetailFixture({actionRequests}),
      });
      MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
    }

    it('places a request under the possible cause it is about', async () => {
      mockAnchoredPage([
        InvestigationActionRequestFixture({
          id: '320',
          key: 'check-cache-hit-rate',
          primary: false,
          anchor: {type: 'hypothesis', id: 'hypothesis-1', blockId: null},
          title: 'Check the cache hit rate',
          action: null,
        }),
      ]);
      renderView();

      const card = await screen.findByRole('region', {name: 'Check the cache hit rate'});
      expect(card).toHaveTextContent(
        'About the possible cause: Database or cache degradation delayed the response'
      );
      expect(
        screen.queryByRole('region', {name: 'Recommended action'})
      ).not.toBeInTheDocument();
    });

    it('places a request under the block it is about', async () => {
      mockAnchoredPage([
        InvestigationActionRequestFixture({
          id: '322',
          key: 'instrument-retries',
          primary: false,
          anchor: {type: 'block', id: 'cause', blockId: 'block-1'},
          title: 'Instrument checkout retries',
          action: null,
        }),
      ]);
      renderView();

      const card = await screen.findByRole('region', {
        name: 'Instrument checkout retries',
      });
      expect(screen.getByText('Initial notes').compareDocumentPosition(card)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
      expect(
        screen.queryByRole('region', {name: 'Recommended action'})
      ).not.toBeInTheDocument();
    });

    it.each([
      ['whose block was removed', {type: 'block', id: 'cause', blockId: null}],
      [
        'about a cause that is gone',
        {type: 'hypothesis', id: 'hypothesis-9', blockId: null},
      ],
      ['with an unknown anchor', {type: 'span', id: 'span-1', blockId: null}],
    ] as const)('shows a request %s above the report', async (_case, anchor) => {
      mockAnchoredPage([
        InvestigationActionRequestFixture({
          primary: false,
          anchor,
          title: 'Instrument checkout retries',
          action: null,
        }),
      ]);
      renderView();

      const card = await screen.findByRole('region', {
        name: 'Instrument checkout retries',
      });
      expect(screen.getByText('Initial notes').compareDocumentPosition(card)).toBe(
        Node.DOCUMENT_POSITION_PRECEDING
      );
      expect(card).not.toHaveTextContent('About the possible cause');
    });

    it('shows requests about a possible cause above the report when the run cannot load', async () => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: InvestigationAgenticDetailFixture({
          actionRequests: [
            InvestigationActionRequestFixture({
              primary: false,
              anchor: {type: 'hypothesis', id: 'hypothesis-1', blockId: null},
              title: 'Check the cache hit rate',
              action: null,
            }),
          ],
        }),
      });
      MockApiClient.addMockResponse({url: orchestrationUrl, statusCode: 500, body: {}});
      renderView();

      const card = await screen.findByRole('region', {name: 'Check the cache hit rate'});
      expect(card).not.toHaveTextContent('About the possible cause');
    });

    it('hides a superseded request under its block', async () => {
      const anchored = {
        primary: false,
        anchor: {type: 'block', id: 'cause', blockId: 'block-1'},
        action: null,
      } as const;
      mockAnchoredPage([
        InvestigationActionRequestFixture({
          ...anchored,
          id: '322',
          key: 'instrument-retries',
          title: 'Instrument checkout retries',
        }),
        InvestigationActionRequestFixture({
          ...anchored,
          id: '323',
          key: 'old-advice',
          reportRevision: completedRun.report.revision - 1,
          state: 'superseded',
          canApply: false,
          cannotApplyReason: 'not_suggested',
          title: 'Old advice',
        }),
      ]);
      renderView();

      expect(
        await screen.findByRole('region', {name: 'Instrument checkout retries'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('region', {name: 'Old advice'})).not.toBeInTheDocument();
    });

    it.each([
      ['under its block', 'block-1'],
      ['above the report', null],
    ])('says Seer is updating a re-checked request %s', async (_case, blockId) => {
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: InvestigationAgenticDetailFixture({
          actionRequests: [
            InvestigationActionRequestFixture({
              id: '322',
              primary: false,
              anchor: {type: 'block', id: 'cause', blockId},
              title: 'Widen the interval',
              state: 'superseded',
              canApply: false,
              cannotApplyReason: 'not_suggested',
              error: {code: 'stale', current: {timeWindowSeconds: 600}},
              followUp: {
                status: 'acknowledged',
                reason: null,
                rerun: null,
                retryable: false,
              },
            }),
          ],
        }),
      });
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'metadata',
          status: 'processing',
        }),
      });
      renderView();

      const card = await screen.findByRole('region', {name: 'Widen the interval'});
      await waitFor(() =>
        expect(within(card).getByRole('status')).toHaveTextContent(
          'Seer is updating its suggestion…'
        )
      );
    });

    describe('before the re-check run shows up', () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      afterEach(async () => {
        try {
          await act(() => jest.runOnlyPendingTimersAsync());
        } finally {
          jest.useRealTimers();
        }
      });

      it('says Seer is updating a request under its block before the run shows up', async () => {
        const rechecked = (status: 'accepted' | 'acknowledged') =>
          InvestigationAgenticDetailFixture({
            actionRequests: [
              InvestigationActionRequestFixture({
                id: '322',
                primary: false,
                anchor: {type: 'block', id: 'cause', blockId: 'block-1'},
                title: 'Widen the interval',
                state: 'superseded',
                canApply: false,
                cannotApplyReason: 'not_suggested',
                error: {code: 'stale', current: {timeWindowSeconds: 600}},
                followUp: {status, reason: null, rerun: null, retryable: false},
              }),
            ],
          });
        MockApiClient.addMockResponse({url: detailUrl, body: rechecked('accepted')});
        MockApiClient.addMockResponse({url: orchestrationUrl, body: completedRun});
        renderView();
        const card = await screen.findByRole('region', {name: 'Widen the interval'});
        expect(within(card).getByRole('status')).toHaveTextContent(
          'Seer is checking the suggestion again…'
        );

        MockApiClient.addMockResponse({url: detailUrl, body: rechecked('acknowledged')});
        await act(() => jest.advanceTimersByTimeAsync(2000));

        await waitFor(() =>
          expect(
            within(screen.getByRole('region', {name: 'Widen the interval'})).getByRole(
              'status'
            )
          ).toHaveTextContent('Seer is updating its suggestion…')
        );
      });
    });
  });

  it('leaves out the investigation details heading without a summary', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture(),
    });

    renderView();

    expect(await screen.findByTestId('investigation-block-block-1')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Investigation details'})
    ).not.toBeInTheDocument();
  });

  it('outlines the report by its headings and scrolls to the one picked', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithReportHeadings(),
    });

    renderView();

    const outline = await screen.findByRole('navigation', {
      name: 'Investigation outline',
    });
    expect(
      within(outline)
        .getAllByRole('link')
        .map(link => link.textContent)
    ).toEqual(['Summary', 'What happened', 'When it happened', 'Activity']);

    const heading = screen.getByRole('heading', {level: 2, name: 'When it happened'});
    heading.scrollIntoView = jest.fn();
    await userEvent.click(within(outline).getByRole('link', {name: 'When it happened'}));

    expect(heading.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    expect(within(outline).getByRole('link', {name: 'When it happened'})).toHaveAttribute(
      'aria-current',
      'location'
    );
  });

  it('follows the reader down the report, holding a picked section until they scroll', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithReportHeadings(),
    });

    renderView();

    const outline = await screen.findByRole('navigation', {
      name: 'Investigation outline',
    });
    // Nothing is laid out, so everything sits at the top of the viewport unless
    // placed: the reader is at the start of the page.
    await waitFor(() =>
      expect(within(outline).getByRole('link', {name: 'Summary'})).toHaveAttribute(
        'aria-current',
        'location'
      )
    );

    // Scroll the summary away, and put the second section and the activity
    // feed below the fold.
    jest
      .spyOn(screen.getByTestId('investigation-summary'), 'getBoundingClientRect')
      .mockReturnValue({top: -300} as DOMRect);
    const nextHeading = screen.getByRole('heading', {level: 2, name: 'When it happened'});
    const nextHeadingRect = jest
      .spyOn(nextHeading, 'getBoundingClientRect')
      .mockReturnValue({top: 600} as DOMRect);
    const activity = screen
      .getByRole('heading', {level: 2, name: 'Activity'})
      .closest('section')!;
    jest.spyOn(activity, 'getBoundingClientRect').mockReturnValue({top: 900} as DOMRect);

    fireEvent.scroll(document);
    await waitFor(() =>
      expect(within(outline).getByRole('link', {name: 'What happened'})).toHaveAttribute(
        'aria-current',
        'location'
      )
    );

    nextHeadingRect.mockReturnValue({top: 100} as DOMRect);
    fireEvent.scroll(document);
    await waitFor(() =>
      expect(
        within(outline).getByRole('link', {name: 'When it happened'})
      ).toHaveAttribute('aria-current', 'location')
    );

    // The activity feed is too close to the end to scroll up past the fold.
    activity.scrollIntoView = jest.fn();
    await userEvent.click(within(outline).getByRole('link', {name: 'Activity'}));
    expect(activity.scrollIntoView).toHaveBeenCalled();
    fireEvent.scroll(document);
    // Let the frame the scroll scheduled run before checking it changed nothing.
    await act(() => new Promise(resolve => window.requestAnimationFrame(resolve)));
    expect(within(outline).getByRole('link', {name: 'Activity'})).toHaveAttribute(
      'aria-current',
      'location'
    );

    // Once the jump has finished, the next scroll is the reader's own.
    await act(() => new Promise(resolve => window.setTimeout(resolve, 300)));
    fireEvent.scroll(document);
    await waitFor(() =>
      expect(
        within(outline).getByRole('link', {name: 'When it happened'})
      ).toHaveAttribute('aria-current', 'location')
    );
  });

  it('leaves the outline out of a report with a single heading', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationDetailFixture({
        blocks: [investigationWithReportHeadings().blocks[0]!],
      }),
    });

    renderView();

    expect(
      await screen.findByRole('heading', {level: 2, name: 'What happened'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', {name: 'Investigation outline'})
    ).not.toBeInTheDocument();
  });

  it('renders partial text while an agent-written text block is running', async () => {
    const investigation = investigationWithQueryResult();
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

  it('does not render stale streamed text after a text block completes', async () => {
    const queryClient = makeTestQueryClient();
    const investigation = investigationWithQueryResult();
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

  it('renders a running block as its title above a placeholder', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks[0] = {
      ...investigation.blocks[0]!,
      content: '',
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
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();

    const block = await screen.findByTestId('investigation-block-block-1');
    expect(within(block).getByRole('heading', {name: 'Summary'})).toBeInTheDocument();
    expect(
      within(block).getByTestId('investigation-block-placeholder')
    ).toBeInTheDocument();
    // The real title is shown, so only the body is a placeholder.
    expect(
      within(block).queryByTestId('investigation-block-placeholder-title')
    ).not.toBeInTheDocument();
  });

  it('keeps an empty block on screen when it pauses on a question', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        content: '',
        outputStatus: 'awaiting_input',
        currentExecution: {
          id: 'execution-awaiting-input',
          status: 'awaiting_input',
          startedAt: '2026-08-18T20:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-1/executions/execution-awaiting-input/`,
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
                options: [{label: 'Production', description: 'Use production events'}],
              },
            ],
          },
        },
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();

    // The block stays put rather than vanishing with the question inside it.
    expect(await screen.findByTestId('investigation-block-block-1')).toBeInTheDocument();
    expect(
      await screen.findByText('Which environment should I inspect?')
    ).toBeInTheDocument();
  });

  it('surfaces the question when a running block pauses mid-run', async () => {
    const queryClient = makeTestQueryClient();
    const running = investigationWithQueryResult();
    running.blocks = [
      {
        ...running.blocks[0]!,
        content: '',
        outputStatus: 'running',
        currentExecution: {
          id: 'execution-1',
          status: 'running',
          startedAt: '2026-08-18T20:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
    const executionUrl = `${detailUrl}blocks/block-1/executions/execution-1/`;
    MockApiClient.addMockResponse({url: detailUrl, body: running});
    MockApiClient.addMockResponse({
      url: executionUrl,
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

    renderView(organization, queryClient);

    expect(await screen.findByRole('heading', {name: 'Summary'})).toBeInTheDocument();
    expect(screen.getByTestId('investigation-block-placeholder')).toBeInTheDocument();

    // The same execution stops for an answer — no new execution id to react to.
    const paused = {
      ...running,
      blocks: [
        {
          ...running.blocks[0]!,
          outputStatus: 'awaiting_input' as const,
          currentExecution: {
            ...running.blocks[0]!.currentExecution!,
            status: 'awaiting_input' as const,
          },
        },
      ],
    };
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({url: detailUrl, body: paused});
    MockApiClient.addMockResponse({
      url: executionUrl,
      body: {
        id: 'execution-1',
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
                options: [{label: 'Production', description: 'Use production events'}],
              },
            ],
          },
        },
        partialMarkdown: null,
        error: null,
      },
    });
    await queryClient.invalidateQueries({
      queryKey: getInvestigationDetailQueryOptions(organization.slug, running.id)
        .queryKey,
    });

    expect(
      await screen.findByText('Which environment should I inspect?')
    ).toBeInTheDocument();
  });

  it('renders a placeholder title and body while the report is still being written', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        blocks: [],
        orchestration: {
          phase: 'reporting',
          status: 'processing',
          heartbeatAt: '2026-08-27T11:06:30Z',
          notebookRevision: 5,
        },
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderView();

    expect(
      await screen.findByTestId('investigation-block-placeholder-title')
    ).toBeInTheDocument();
    expect(screen.getByTestId('investigation-block-placeholder')).toBeInTheDocument();
  });

  it('keeps the report placeholder while every existing block has settled', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = investigation.blocks.map(block => ({
      ...block,
      outputStatus: 'available' as const,
    }));
    investigation.orchestration = {
      phase: 'reporting',
      status: 'processing',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderView();

    expect(
      await screen.findByTestId('investigation-block-placeholder-title')
    ).toBeInTheDocument();
  });

  it('holds back the activity feed until the run has stopped', async () => {
    const investigation = investigationWithQueryResult();
    investigation.orchestration = {
      phase: 'investigating',
      status: 'processing',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderView();

    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Activity'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Comment'})).not.toBeInTheDocument();
  });

  it.each(['completed', 'failed', 'cancelled'] as const)(
    'shows the activity feed once the run has %s',
    async status => {
      const investigation = investigationWithQueryResult();
      investigation.orchestration = {
        phase: status,
        status,
        heartbeatAt: '2026-08-27T11:06:30Z',
        notebookRevision: 5,
      };
      MockApiClient.addMockResponse({url: detailUrl, body: investigation});
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({status}),
      });

      renderView();

      expect(await screen.findByRole('heading', {name: 'Activity'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Comment'})).toBeInTheDocument();
    }
  );

  it.each(['failed', 'cancelled'] as const)(
    'still awaits the report when a block has %s',
    async status => {
      const investigation = investigationWithQueryResult();
      investigation.blocks = [
        {
          ...investigation.blocks[0]!,
          outputStatus: status,
          currentExecution: {
            id: 'execution-1',
            status,
            startedAt: '2026-08-18T20:00:00Z',
            completedAt: '2026-08-18T20:01:00Z',
            error: {code: 'query_timeout', message: 'That query timed out.'},
          },
        },
      ];
      investigation.orchestration = {
        phase: 'reporting',
        status: 'processing',
        heartbeatAt: '2026-08-27T11:06:30Z',
        notebookRevision: 5,
      };
      MockApiClient.addMockResponse({url: detailUrl, body: investigation});
      MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture(),
      });

      renderView();

      expect(
        await screen.findByTestId('investigation-block-placeholder-title')
      ).toBeInTheDocument();
    }
  );

  it('does not render a report placeholder while a block is still working', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        content: '',
        outputStatus: 'running',
        currentExecution: {
          id: 'execution-1',
          status: 'running',
          startedAt: '2026-08-18T20:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
    investigation.orchestration = {
      phase: 'reporting',
      status: 'processing',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
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
        partialMarkdown: null,
        error: null,
      },
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderView();

    // Just the running block's own placeholder, not a second one for the report.
    expect(await screen.findByRole('heading', {name: 'Summary'})).toBeInTheDocument();
    expect(screen.getAllByTestId('investigation-block-placeholder')).toHaveLength(1);
    expect(
      screen.queryByTestId('investigation-block-placeholder-title')
    ).not.toBeInTheDocument();
  });

  it('does not render a report placeholder outside the reporting phase', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = investigation.blocks.map(block => ({
      ...block,
      outputStatus: 'available' as const,
    }));
    investigation.orchestration = {
      phase: 'investigating',
      status: 'processing',
      heartbeatAt: '2026-08-27T11:06:30Z',
      notebookRevision: 5,
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({phase: 'investigating'}),
    });

    renderView();

    expect(await screen.findByText('Investigate database latency')).toBeInTheDocument();
    expect(
      screen.queryByTestId('investigation-block-placeholder-title')
    ).not.toBeInTheDocument();
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

  describe('renders the persisted title when completion has no preview with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
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

      const startedAt = Date.now();
      renderView();
      expect(
        await screen.findByDisplayValue('Untitled investigation')
      ).toBeInTheDocument();

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

      await act(() => jest.advanceTimersByTimeAsync(500));
      await waitFor(() =>
        expect(screen.getByRole('textbox', {name: 'Investigation title'})).toHaveValue(
          'Mobile API Monitor False Alert'
        )
      );
      // Completion must refresh metadata before the independent 2s detail poll.
      expect(Date.now() - startedAt).toBeLessThan(2000);
      expect(screen.getByText(/Comparison logic triggered breach/)).toBeInTheDocument();
    });
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

  it('shows a placeholder for the running block, then the results', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks[0] = {
      ...investigation.blocks[0]!,
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
        partialMarkdown: null,
        error: null,
      },
    });
    const {queryClient} = renderView();

    await screen.findByText('Investigate database latency');
    // The block that hasn't started is not shown at all.
    expect(screen.getByLabelText('Block actions for Summary')).toBeInTheDocument();
    expect(screen.getByTestId('investigation-block-placeholder')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Block actions for Latency query')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Close Seer panel'})
    ).not.toBeInTheDocument();

    const completed = {
      ...investigation,
      blocks: investigation.blocks.map(block => ({
        ...block,
        outputStatus: 'completed' as const,
        currentExecution: null,
        output:
          block.kind === 'text'
            ? {schemaVersion: 1, markdown: 'Timeouts began after the deployment.'}
            : InvestigationQueryOutputFixture(),
      })),
    };
    MockApiClient.addMockResponse({url: detailUrl, body: completed});
    await queryClient.invalidateQueries({
      queryKey: getInvestigationDetailQueryOptions(organization.slug, investigation.id)
        .queryKey,
    });

    expect(await screen.findByText('Timeouts began after the deployment.')).toBeVisible();
    expect(await screen.findByText('1.84s')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Latency query'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  describe('refetches while Seer Agent works with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    /** Seer Agent mid-turn, until "Seer finished" ends it. */
    function SeerWorkingProvider({children}: {children: ReactNode}) {
      const seerExplorer = useSeerExplorerContext();
      const [sessionState, setSessionState] =
        useState<SeerExplorerContextValue['sessionState']>('thinking');
      return (
        <SeerExplorerContext.Provider value={{...seerExplorer, sessionState}}>
          <Button onClick={() => setSessionState('inactive')}>Seer finished</Button>
          {children}
        </SeerExplorerContext.Provider>
      );
    }

    it('refetches a settled investigation while Seer Agent works and once it stops', async () => {
      const detailRequest = MockApiClient.addMockResponse({
        url: detailUrl,
        body: InvestigationAgenticDetailFixture({
          orchestration: {
            phase: 'completed',
            status: 'completed',
            heartbeatAt: '2026-08-27T11:06:30Z',
            notebookRevision: 5,
          },
        }),
      });
      const orchestrationRequest = MockApiClient.addMockResponse({
        url: orchestrationUrl,
        body: InvestigationOrchestrationFixture({
          phase: 'completed',
          status: 'completed',
        }),
      });

      render(<InvestigationDetailView />, {
        additionalWrapper: SeerWorkingProvider,
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/seer/investigations/investigation-1/',
          },
          route: '/organizations/:orgId/seer/investigations/:investigationId/',
        },
      });

      expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
      expect(detailRequest).toHaveBeenCalledTimes(1);
      expect(orchestrationRequest).toHaveBeenCalledTimes(1);

      // Seer Agent's writes go to the block routes, so the page keeps reading.
      await act(() => jest.advanceTimersByTimeAsync(2000));
      expect(detailRequest).toHaveBeenCalledTimes(2);

      // One more read for what it wrote after the last poll, then it settles.
      fireEvent.click(screen.getByRole('button', {name: 'Seer finished'}));
      await act(() => jest.advanceTimersByTimeAsync(0));
      expect(detailRequest).toHaveBeenCalledTimes(3);
      expect(orchestrationRequest).toHaveBeenCalledTimes(2);
      await act(() => jest.advanceTimersByTimeAsync(4000));
      expect(detailRequest).toHaveBeenCalledTimes(3);
    });
  });

  it.each(['notRun', 'failed', 'cancelled', 'completed'] as const)(
    'hides query blocks with no usable output when %s',
    async status => {
      const investigation = InvestigationDetailFixture();
      investigation.blocks = [
        {
          ...investigation.blocks[1]!,
          outputStatus: status,
          currentExecution: null,
          output: null,
        },
      ];
      MockApiClient.addMockResponse({url: detailUrl, body: investigation});
      renderView();

      await screen.findByText('Investigate database latency');
      expect(
        screen.queryByLabelText('Block actions for Latency query')
      ).not.toBeInTheDocument();
    }
  );

  it.each(['pending', 'running'] as const)(
    'shows a %s query block as its title above a placeholder',
    async status => {
      const investigation = InvestigationDetailFixture();
      investigation.blocks = [
        {
          ...investigation.blocks[1]!,
          outputStatus: status,
          currentExecution: null,
          output: null,
        },
      ];
      MockApiClient.addMockResponse({url: detailUrl, body: investigation});

      renderView();

      expect(
        await screen.findByLabelText('Block actions for Latency query')
      ).toBeInTheDocument();
      expect(screen.getByTestId('investigation-block-placeholder')).toBeInTheDocument();
    }
  );

  it('still hides a queued block that has never been dispatched', async () => {
    const investigation = InvestigationDetailFixture();
    investigation.blocks = [
      {
        ...investigation.blocks[1]!,
        outputStatus: 'notRun',
        currentExecution: null,
        output: null,
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    await screen.findByText('Investigate database latency');
    expect(
      screen.queryByLabelText('Block actions for Latency query')
    ).not.toBeInTheDocument();
  });

  it('omits completed empty results from the report', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks[1]!.output = InvestigationQueryOutputFixture({
      isEmpty: true,
      tableMarkdown: '| Events |\n| --- |',
      chartUnavailableReason: 'No events in this window.',
    });
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    renderView();

    await screen.findByText('Initial notes');
    expect(
      screen.queryByLabelText('Block actions for Latency query')
    ).not.toBeInTheDocument();
  });

  it('asks Seer about a block with its result as context', async () => {
    const investigation = investigationWithQueryResult();
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    await chooseBlockAction('Latency query', 'Ask Seer');

    expect(openChatPrompt).toHaveBeenCalledTimes(1);
    expect(openChatPrompt).toHaveBeenCalledWith({
      prompt: 'How do you want to steer the investigation: "Latency query"?',
      context: {
        investigation: {
          id: 'investigation-1',
          title: 'Investigate database latency',
          version: 1,
        },
        block: {
          id: 'block-2',
          version: 1,
          position: 1,
          title: 'Latency query',
          kind: 'query',
          output: InvestigationQueryOutputFixture().tableMarkdown,
          request: 'Find slow spans',
        },
      },
    });
    // The question goes to Seer Agent; nothing opens or runs in the block.
    expect(screen.queryByTestId('investigation-transcript')).not.toBeInTheDocument();
  });

  it('sends only the start of a long block result to Seer', async () => {
    const investigation = investigationWithQueryResult();
    const row = '| /api/checkout | 1.84s | 18,402 |\n';
    investigation.blocks[1] = {
      ...investigation.blocks[1]!,
      output: InvestigationQueryOutputFixture({tableMarkdown: row.repeat(1000)}),
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    await chooseBlockAction('Latency query', 'Ask Seer');

    const {block} = openChatPrompt.mock.calls[0][0].context;
    expect(block.output).toHaveLength(4000);
    expect(row.repeat(1000).startsWith(block.output)).toBe(true);
    expect(block.outputTruncated).toBe(true);
  });

  it('asks Seer about a text block that has only content', async () => {
    MockApiClient.addMockResponse({url: detailUrl, body: investigationWithQueryResult()});
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    await chooseBlockAction('Summary', 'Ask Seer');

    expect(openChatPrompt).toHaveBeenCalledWith({
      prompt: 'How do you want to steer the investigation: "Summary"?',
      context: {
        investigation: {
          id: 'investigation-1',
          title: 'Investigate database latency',
          version: 1,
        },
        block: {
          id: 'block-1',
          version: 1,
          position: 0,
          title: 'Summary',
          kind: 'text',
          output: 'Initial notes',
        },
      },
    });
  });

  it('renders block output instead of block content', async () => {
    const investigation = investigationWithQueryResult();
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

  it('renders breadcrumbs, the page title, and text and table results without prompt data', async () => {
    const investigation = investigationWithQueryResult();
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
    expect(screen.getByTestId('text-block-result')).toHaveAttribute(
      'data-block-variant',
      'unbordered'
    );
    expect(screen.getByTestId('query-block')).toContainElement(screen.getByText('820ms'));
    expect(screen.getByTestId('query-block')).toContainElement(
      screen.getByRole('button', {name: 'Block actions for Database latency'})
    );
    expect(screen.getByText('820ms')).toBeInTheDocument();
    expect(screen.queryByText('Secret text-generation prompt')).not.toBeInTheDocument();
    expect(screen.queryByText('Secret query-generation prompt')).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Investigations'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/seer/investigations/'
    );
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent(
      investigation.title
    );

    const toggle = screen.getByRole('button', {name: 'Database latency'});

    await userEvent.click(toggle);
    expect(screen.getByText('820ms')).not.toBeVisible();
    await userEvent.click(toggle);
    expect(screen.getByText('820ms')).toBeVisible();
  });

  it('shows generated query evidence expanded when ready', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = [
      {
        ...investigation.blocks[1]!,
        config: {autoRun: true},
        outputStatus: 'completed',
        output: {
          schemaVersion: 1,
          preferredView: 'table',
          tableMarkdown: '| p95 |\n| --- |\n| 820ms |',
          chart: null,
          chartUnavailableReason: null,
          isEmpty: false,
          queryLinks: [],
        },
        currentExecution: {
          id: 'execution-completed',
          status: 'completed',
          startedAt: '2026-08-17T10:00:00Z',
          completedAt: '2026-08-17T10:00:10Z',
          error: null,
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});

    renderView();

    const toggle = await screen.findByRole('button', {name: 'Latency query'});
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('820ms')).toBeVisible();
    expect(screen.queryByRole('button', {name: 'Show query'})).not.toBeInTheDocument();
    expect(screen.getByTestId('query-block')).toContainElement(
      screen.getByRole('button', {name: 'Block actions for Latency query'})
    );

    await userEvent.click(toggle);

    expect(screen.getByText('820ms')).not.toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('820ms')).toBeVisible();

    await userEvent.keyboard(' ');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(
      screen.getByRole('button', {name: 'Block actions for Latency query'})
    );
    expect(screen.getByRole('menuitemradio', {name: 'Delete'})).toBeVisible();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders the outer query title as non-editable text', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });
    renderView();
    expect(
      await screen.findByRole('heading', {level: 3, name: 'Latency query'})
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Block title for Latency query')
    ).not.toBeInTheDocument();
  });

  it('renders a preferred chart and falls back to its table when unavailable', async () => {
    const investigation = investigationWithQueryResult();
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
    expect(
      screen.getAllByRole('heading', {level: 3, name: 'Latency query'})[0]
    ).toBeInTheDocument();
    expect(screen.getByText('Latency over time')).toBeInTheDocument();
    expect(
      within(screen.getAllByTestId('query-block-header')[0]!).getByText(
        /Aug 17.*1,200 total p95/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('shown')).toBeInTheDocument();
  });

  it('renders chart metadata without offering Rerun', async () => {
    const investigation = investigationWithQueryResult();
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

    renderView();
    const chartHeader = await screen.findByTestId('query-block-header');
    expect(
      within(chartHeader).getByRole('heading', {
        name: 'Top Issues in spike window',
      })
    ).toBeInTheDocument();
    expect(
      within(chartHeader).getByText(/3:57pm–4:12pm PST\s+\|\s+363 Total Events/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Block actions for Latency query')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Ask Seer about Latency query'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Rerun Latency query'})
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Block actions for Latency query'));
    expect(screen.queryByRole('menuitemradio', {name: 'Rerun'})).not.toBeInTheDocument();
  });

  it('deletes a query block when it is no longer present in the cache', async () => {
    const investigation = investigationWithQueryResult();
    const block = investigation.blocks[1]!;
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const deleteRequest = MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/${block.id}/`,
      method: 'DELETE',
    });

    renderView(organization, queryClient);
    await chooseBlockAction('Latency query', 'Delete');
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

  it('deletes a text block from its actions menu', async () => {
    const investigation = investigationWithQueryResult();
    const block = investigation.blocks[0]!;
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const deleteRequest = MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/${block.id}/`,
      method: 'DELETE',
    });

    renderView();
    await chooseBlockAction('Summary', 'Delete');
    expect(deleteRequest).not.toHaveBeenCalled();
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('confirm-button'));

    await waitFor(() =>
      expect(deleteRequest).toHaveBeenCalledWith(
        `${detailUrl}blocks/${block.id}/`,
        expect.objectContaining({
          data: {investigationVersion: 1, version: 1},
        })
      )
    );
    expect(
      screen.queryByTestId(`investigation-block-${block.id}`)
    ).not.toBeInTheDocument();
  });

  it('keeps the previous result visible while showing a timed transcript of a run', async () => {
    const queryClient = makeTestQueryClient();
    const investigation = InvestigationDetailFixture({version: 7});
    const block = investigation.blocks[0]!;
    const running = {
      ...block,
      version: 3,
      content: 'Previous successful result',
      outputStatus: 'running' as const,
      output: null,
      currentExecution: {
        id: 'execution-2',
        status: 'running' as const,
        startedAt: '2026-08-17T10:00:00Z',
        completedAt: null,
        error: null,
      },
    };
    investigation.blocks = [running];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const executionUrl = `${detailUrl}blocks/block-1/executions/execution-2/`;
    MockApiClient.addMockResponse({
      url: executionUrl,
      body: {
        id: 'execution-2',
        status: 'running',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, queryClient, false, openChatPrompt);
    expect(await screen.findByText('Previous successful result')).toBeInTheDocument();
    expect(await screen.findByText('Working on this analysis…')).toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: detailUrl,
      body: {
        ...investigation,
        blocks: [
          {
            ...running,
            outputStatus: 'completed',
            currentExecution: {
              ...running.currentExecution,
              status: 'completed',
              completedAt: '2026-08-17T10:00:10Z',
            },
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: executionUrl,
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
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: investigationExecutionDetailQueryOptions({
          organizationSlug: organization.slug,
          investigationId: investigation.id,
          blockId: block.id,
          executionId: 'execution-2',
        }).queryKey,
      })
    );

    expect(await screen.findByText('Analysis complete')).toBeInTheDocument();
    expect(screen.getByText('Previous successful result')).toBeInTheDocument();
    expect(screen.getByText('Compare against deploys')).toBeInTheDocument();
    expect(screen.getByText('The deploy lines up.')).toBeInTheDocument();
    expect(screen.queryByText(/Private agent instructions/)).not.toBeInTheDocument();
    expect(await screen.findByText('10.0s')).toBeInTheDocument();
    expect(screen.getByText('4.0s')).toBeInTheDocument();
    expect(screen.getByText('6.0s')).toBeInTheDocument();
    expect(screen.queryByText('2.0s')).not.toBeInTheDocument();
    expect(screen.queryByText('3.0s')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Stop'})).not.toBeInTheDocument();

    // A finished run hands follow-ups to Seer Agent.
    await userEvent.click(screen.getByRole('button', {name: 'Ask Seer'}));
    expect(openChatPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'How do you want to steer the investigation: "Summary"?',
      })
    );
  });

  it('shows "Building chart…" for a query block\'s in-progress structured result instead of raw JSON', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks[1] = {
      ...investigation.blocks[1]!,
      outputStatus: 'running',
      currentExecution: {
        id: 'execution-building',
        status: 'running',
        startedAt: '2026-08-18T20:00:00Z',
        completedAt: null,
        error: null,
      },
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-2/executions/execution-building/`,
      body: {
        id: 'execution-building',
        status: 'running',
        blocks: [
          {
            id: 'step-1',
            timestamp: '2026-08-18T20:00:01Z',
            loading: true,
            message: {
              role: 'assistant',
              content: '{"tableMarkdown":"| Fact | Value |\\n|---|---|\\n| Monit',
            },
            artifacts: [],
            toolLinks: null,
            toolResults: null,
          },
        ],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();

    expect(await screen.findByText('Building chart…')).toBeInTheDocument();
    expect(screen.queryByText(/tableMarkdown/)).not.toBeInTheDocument();
  });

  it("hides a query block's completed structured result from the transcript, not just while streaming", async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks[1] = {
      ...investigation.blocks[1]!,
      outputStatus: 'running',
      currentExecution: {
        id: 'execution-built',
        status: 'running',
        startedAt: '2026-08-18T20:00:00Z',
        completedAt: null,
        error: null,
      },
    };
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({
      url: `${detailUrl}blocks/block-2/executions/execution-built/`,
      body: {
        id: 'execution-built',
        status: 'completed',
        blocks: [
          {
            id: 'step-1',
            timestamp: '2026-08-18T20:00:04Z',
            loading: false,
            message: {
              role: 'assistant',
              content:
                '{"tableMarkdown":"| Fact | Value |","chart":null,"preferredView":"table","isEmpty":false,"chartUnavailableReason":null}',
            },
            artifacts: [],
            toolLinks: null,
            toolResults: null,
          },
        ],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      },
    });

    renderView();

    // The transcript renders once the block settles, but the raw JSON answer is dropped —
    // `QueryResult` above already presents its parsed chart/table.
    expect(await screen.findByText('No steps')).toBeInTheDocument();
    expect(screen.queryByText(/tableMarkdown/)).not.toBeInTheDocument();
    expect(screen.queryByText('Building chart…')).not.toBeInTheDocument();
  });

  it('stops a running block and leaves the rendered result visible', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        outputStatus: 'running',
        output: {schemaVersion: 1, markdown: 'Stable result'},
        currentExecution: {
          id: 'execution-running',
          status: 'running',
          startedAt: '2026-08-18T20:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    const executionUrl = `${detailUrl}blocks/block-1/executions/execution-running/`;
    MockApiClient.addMockResponse({
      url: executionUrl,
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
      url: executionUrl,
      method: 'DELETE',
    });

    renderView();
    await userEvent.click(await screen.findByRole('button', {name: 'Stop'}));

    await waitFor(() => expect(stopRequest).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Stable result')).toBeInTheDocument();
  });

  it('reopens the activity of a running block after its panel is closed', async () => {
    const investigation = investigationWithQueryResult();
    investigation.blocks = [
      {
        ...investigation.blocks[0]!,
        outputStatus: 'running',
        output: {schemaVersion: 1, markdown: 'Stable result'},
        currentExecution: {
          id: 'execution-running',
          status: 'running',
          startedAt: '2026-08-18T20:00:00Z',
          completedAt: null,
          error: null,
        },
      },
    ];
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

    renderView();
    await userEvent.click(await screen.findByRole('button', {name: 'Close Seer panel'}));
    expect(screen.queryByText('Working on this analysis…')).not.toBeInTheDocument();

    await chooseBlockAction('Summary', 'Show Seer activity');
    expect(await screen.findByText('Working on this analysis…')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Stop'})).toBeInTheDocument();

    // Only offered while the panel is closed.
    await userEvent.click(
      screen.getByRole('button', {name: 'Block actions for Summary'})
    );
    expect(
      screen.queryByRole('menuitemradio', {name: 'Show Seer activity'})
    ).not.toBeInTheDocument();
  });

  it('answers a question while an execution is awaiting input', async () => {
    const investigation = investigationWithQueryResult();
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
      body: investigationWithQueryResult(),
    });
    const queryClient = makeTestQueryClient();

    await queryClient.prefetchQuery(
      getInvestigationDetailQueryOptions('org-slug', 'investigation-1')
    );
    renderView(organization, queryClient);

    expect(screen.getByText('Investigate database latency')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
  });

  describe('optimistically renames and debounces persistence with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('optimistically renames and debounces persistence', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWithQueryResult(),
      });
      const renameRequest = MockApiClient.addMockResponse({
        url: detailUrl,
        method: 'PUT',
        body: InvestigationDetailFixture({
          title: 'Renamed',
          version: 2,
        }),
      });

      renderView();
      const titleInput = await screen.findByLabelText('Investigation title');
      await user.clear(titleInput);
      await user.type(titleInput, 'Renamed');

      expect(titleInput).toHaveValue('Renamed');
      expect(renameRequest).not.toHaveBeenCalled();

      await act(() => jest.advanceTimersByTimeAsync(499));
      expect(renameRequest).not.toHaveBeenCalled();
      await act(() => jest.advanceTimersByTimeAsync(1));
      await waitFor(() =>
        expect(renameRequest).toHaveBeenCalledWith(
          detailUrl,
          expect.objectContaining({
            data: {
              title: 'Renamed',
              investigationVersion: 1,
            },
          })
        )
      );
    });
  });

  it('preserves newer block state when a rename completes', async () => {
    const queryClient = makeTestQueryClient();
    const options = getInvestigationDetailQueryOptions('org-slug', 'investigation-1');
    const investigation = investigationWithQueryResult();
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
      body: investigationWithQueryResult(),
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

  describe('polls for and displays a generated title after block execution finishes with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('polls for and displays a generated title after block execution finishes', async () => {
      let requestCount = 0;
      MockApiClient.addMockResponse({
        url: titleGenerationUrl,
        body: {status: 'running', preview: null},
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
      expect(
        await screen.findByDisplayValue('Untitled Investigation')
      ).toBeInTheDocument();

      expect(requestCount).toBe(1);
      await act(() => jest.advanceTimersByTimeAsync(2000));
      expect(
        screen.getByDisplayValue('Generated latency investigation')
      ).toBeInTheDocument();
      expect(requestCount).toBe(2);
    });
  });

  it('duplicates and opens the duplicate from the title menu', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}duplicate/`,
      method: 'POST',
      body: InvestigationDetailFixture({id: 'investigation-2'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/investigation-2/presence/',
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/investigation-2/comments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/investigations/investigation-2/comment-counts/',
      body: {},
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
        '/organizations/org-slug/seer/investigations/investigation-2/'
      )
    );
  });

  it('copies the link from the title menu', async () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, 'clipboard', {
      value: {writeText},
      writable: true,
    });
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });

    renderView();
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Copy link'}));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/seer/investigations/investigation-1/`
      )
    );
  });

  it('shows a capped comment count when more comments exist', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });
    MockApiClient.addMockResponse({
      url: `${detailUrl}comments/`,
      body: [InvestigationCommentFixture()],
      headers: {
        Link: `<${detailUrl}comments/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });

    renderView();

    expect(await screen.findByRole('button', {name: '1+ comments'})).toBeInTheDocument();
  });

  describe('deletes after confirmation and returns to the list with fake timers', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(async () => {
      try {
        await act(() => jest.runOnlyPendingTimersAsync());
      } finally {
        jest.useRealTimers();
      }
    });

    it('deletes after confirmation and returns to the list', async () => {
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      MockApiClient.addMockResponse({
        url: detailUrl,
        body: investigationWithQueryResult(),
      });
      let finishDelete!: () => void;
      const deleteResponse = new Promise<void>(resolve => {
        finishDelete = resolve;
      });
      const deleteRequest = MockApiClient.addMockResponse({
        url: detailUrl,
        method: 'DELETE',
        asyncDelay: deleteResponse,
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
      await user.click(await screen.findByLabelText('Investigation actions'));
      await user.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));
      expect(deleteRequest).not.toHaveBeenCalled();
      renderGlobalModal();
      await user.click(await screen.findByTestId('confirm-button'));

      await waitFor(() =>
        expect(deleteRequest).toHaveBeenCalledWith(
          detailUrl,
          expect.objectContaining({data: {investigationVersion: 1}})
        )
      );
      await act(() => jest.advanceTimersByTimeAsync(600));
      expect(renameRequest).not.toHaveBeenCalled();

      await act(async () => {
        finishDelete();
        await deleteResponse;
      });
      await waitFor(() =>
        expect(router.location.pathname).toBe(
          '/organizations/org-slug/seer/investigations/'
        )
      );
      await act(() => jest.advanceTimersByTimeAsync(600));
      expect(renameRequest).not.toHaveBeenCalled();
    });
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
      json: investigationWithQueryResult(),
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
      body: investigationWithQueryResult(),
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
      body: investigationWithQueryResult(),
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

  // `orchestration` being present is the only thing that marks an investigation
  // as agentic, and the orchestration endpoint 404s without a run, so the gate
  // has to hold in both directions.
  it('renders the live run status beside the investigation title and hypotheses below', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture(),
    });
    const orchestrationRequest = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        startedAt: '2025-01-01T00:00:00Z',
        finishedAt: null,
        activeTimeElapsedSeconds: 20,
        activeSince: '2025-01-01T00:05:00Z',
        serverTime: '2025-01-01T00:05:14.500Z',
      }),
    });

    const {queryClient} = renderView();

    expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
    expect(orchestrationRequest).toHaveBeenCalledTimes(1);
    const header = screen.getByRole('banner');
    expect(
      within(header).getByRole('textbox', {name: 'Investigation title'})
    ).toBeInTheDocument();
    expect(within(header).getByText('Synthesizing…')).toBeInTheDocument();
    expect(within(header).getByRole('timer')).toBeVisible();
    expect(
      within(screen.getByTestId('seer-status-block')).queryByText('Synthesizing…')
    ).not.toBeInTheDocument();

    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture({
        status: 'completed',
        phase: 'completed',
        startedAt: '2025-01-01T00:00:00Z',
        finishedAt: '2025-01-01T00:05:15Z',
        activeTimeElapsedSeconds: 35,
        activeSince: null,
        serverTime: '2025-01-01T00:05:15Z',
      }),
    });
    await act(() =>
      queryClient.invalidateQueries({
        queryKey: investigationOrchestrationQueryOptions(
          organization.slug,
          'investigation-1'
        ).queryKey,
      })
    );

    expect(await within(header).findByText('Completed')).toBeInTheDocument();
    expect(within(header).getByRole('timer')).toHaveTextContent('35.0s');
    expect(within(header).queryByText('Synthesizing…')).not.toBeInTheDocument();
    // The header badge carries a finished run; the block above the hypotheses
    // only shows while there is something still in flight or needing attention.
    expect(screen.queryByTestId('seer-status-block')).not.toBeInTheDocument();
  });

  it('asks Seer about the whole investigation from the title menu', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture({
        summary: 'A cache regression',
        projectIds: [42],
      }),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
    await userEvent.click(screen.getByLabelText('Investigation actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Ask Seer'}));

    expect(openChatPrompt).toHaveBeenCalledTimes(1);
    const {prompt, context} = openChatPrompt.mock.calls[0][0];
    expect(prompt).toBe('What would you like to know about this investigation?');
    // The investigation's node, with its hypotheses and blocks beneath it.
    expect(context.nodeType).toBe('investigation');
    expect(context.data).toEqual(
      expect.objectContaining({
        id: 'investigation-1',
        title: 'Investigate database latency',
        status: 'active',
        projectIds: [42],
        sourceType: 'manual',
        sourceRef: {},
        summary: 'A cache regression',
        runStatus: 'processing',
        runPhase: 'reporting',
      })
    );
    const childData = (nodeType: string) =>
      context.children
        .filter((child: LLMContextNodeSnapshot) => child.nodeType === nodeType)
        .map((child: LLMContextNodeSnapshot) => child.data);
    const hypotheses = childData('investigation-hypothesis');
    expect(hypotheses).toHaveLength(3);
    expect(hypotheses).toContainEqual(
      expect.objectContaining({
        number: 1,
        statement: 'Database or cache degradation delayed the response',
        status: 'supported',
        isConclusion: true,
      })
    );
    // Only the blocks on screen: the query has no result yet, so it is hidden.
    expect(childData('investigation-block')).toEqual([
      {
        id: 'block-1',
        version: 1,
        position: 0,
        title: 'Summary',
        kind: 'text',
        output: 'Initial notes',
      },
    ]);
  });

  it("sends the investigation's run state before the full run arrives", async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture(),
    });
    let finishOrchestration!: () => void;
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
      asyncDelay: new Promise<void>(resolve => {
        finishOrchestration = resolve;
      }),
    });
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    await userEvent.click(await screen.findByLabelText('Investigation actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Ask Seer'}));

    const {context} = openChatPrompt.mock.calls[0][0];
    expect(context.data).toEqual(
      expect.objectContaining({runStatus: 'processing', runPhase: 'investigating'})
    );
    finishOrchestration();
    expect(await screen.findAllByTestId('investigation-hypothesis')).toHaveLength(3);
  });

  it('asks Seer about a hypothesis from its menu', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: InvestigationAgenticDetailFixture(),
    });
    MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });
    const openChatPrompt = jest.fn();

    renderView(askSeerOrganization, makeTestQueryClient(), false, openChatPrompt);
    await screen.findAllByTestId('investigation-hypothesis');
    // A run past verification opens with its hypotheses folded away.
    await userEvent.click(screen.getByRole('button', {name: /Hypotheses/}));
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Actions for Database or cache degradation delayed the response',
      })
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Ask Seer'}));

    expect(openChatPrompt).toHaveBeenCalledTimes(1);
    const {prompt, context} = openChatPrompt.mock.calls[0][0];
    expect(prompt).toBe('What would you like to know about this hypothesis?');
    expect(context.investigation).toEqual({
      id: 'investigation-1',
      title: 'Investigate database latency',
      version: 1,
    });
    expect(context.hypothesis).toEqual(
      expect.objectContaining({
        id: 'hypothesis-1',
        number: 1,
        statement: 'Database or cache degradation delayed the response',
        status: 'supported',
        isConclusion: true,
        verdict: {
          verdict: 'supported',
          rationale: 'Every check points at the same cache regression.',
          remainingGaps: [],
        },
      })
    );
    expect(context.hypothesis.verificationSteps).toHaveLength(3);
    expect(context.hypothesis.verificationSteps[1]).toEqual({
      title: 'Compare organization lookup spans',
      objective: 'Isolate the slow span.',
      status: expect.any(String),
      result: 'The lookup slowed sharply during the incident window.',
    });
  });

  it('does not reach for orchestration on a manual investigation', async () => {
    MockApiClient.addMockResponse({
      url: detailUrl,
      body: investigationWithQueryResult(),
    });
    const orchestrationRequest = MockApiClient.addMockResponse({
      url: orchestrationUrl,
      body: InvestigationOrchestrationFixture(),
    });

    renderView();

    expect(
      await screen.findByRole('textbox', {name: 'Investigation title'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('investigation-hypotheses')).not.toBeInTheDocument();
    expect(orchestrationRequest).not.toHaveBeenCalled();
  });
});
