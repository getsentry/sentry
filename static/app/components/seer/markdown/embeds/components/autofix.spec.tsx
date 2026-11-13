import {Fragment, useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixExplorerStep,
  ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixChatProvider} from 'sentry/components/seer/autofixChatContext';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {SeerOutOfCreditsCtaProps} from 'sentry/components/seer/outOfCredits/seerOutOfCreditsCta';
import {registerOverride} from 'sentry/overrideRegistry';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AutofixRef} from './autofix';

const organization = OrganizationFixture({slug: 'org-slug'});
const GROUP_ID = '1337';

function makeRun(status: ExplorerAutofixState['status']): ExplorerAutofixState {
  const finished = status !== 'processing';

  return {
    run_id: 42,
    status,
    updated_at: '2026-01-01T00:00:00Z',
    blocks: [
      {
        id: 'block-1',
        timestamp: '2026-01-01T00:00:00Z',
        loading: !finished,
        message: {
          role: 'assistant',
          // 'Thinking...' is what keeps an unfinished section out of the
          // completed state; any other assistant content closes the section.
          content: finished ? 'Here is what went wrong' : 'Thinking...',
          metadata: {step: 'root_cause'},
        },
        artifacts: finished
          ? [
              {
                key: 'artifact-1',
                reason: 'Found a root cause',
                data: {
                  one_line_description: 'The cache key collides across orgs',
                  five_whys: ['The key omits the org slug'],
                },
              },
            ]
          : [],
      },
    ],
  };
}

/**
 * A run parked in `processing` so the embed keeps polling, whose code_changes
 * section already reads as completed. `withPullRequest` adds the PR state that
 * makes `findStepSection` swap a `pr_iteration` embed off that section.
 */
function makePrIterationRun({
  withPullRequest,
}: {
  withPullRequest: boolean;
}): ExplorerAutofixState {
  return {
    run_id: 42,
    status: 'processing',
    updated_at: '2026-01-01T00:00:00Z',
    blocks: [
      {
        id: 'block-1',
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'assistant',
          content: 'Applied the patch',
          metadata: {step: 'code_changes'},
        },
      },
    ],
    ...(withPullRequest
      ? {
          repo_pr_states: {
            'getsentry/sentry': {
              branch_name: 'seer/fix',
              commit_sha: 'abc123',
              pr_creation_error: null,
              pr_creation_status: 'completed',
              pr_id: 1,
              pr_number: 1,
              pr_url: 'https://github.com/getsentry/sentry/pull/1',
              repo_name: 'getsentry/sentry',
              title: 'Fix the cache key',
            },
          } satisfies ExplorerAutofixState['repo_pr_states'],
        }
      : {}),
  };
}

/**
 * Stands in for a page the chat panel slides over: it holds an issue-list query
 * open so the refetch triggered by a finished step is observable.
 */
function InboxBehindThePanel({step = 'root_cause'}: {step?: string}) {
  const org = useOrganization();

  useInfiniteQuery(
    apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: org.slug},
      query: {query: 'issue.progress:diagnosed is:unresolved'},
      staleTime: 0,
    })
  );

  return (
    <AutofixRef
      name="autofixRef"
      level="block"
      data={{id: GROUP_ID, shortId: 'JAVASCRIPT-1', runId: 42, step}}
    />
  );
}

const STEP_ORDER: AutofixExplorerStep[] = ['root_cause', 'solution', 'code_changes'];

const STEP_ARTIFACTS: Partial<Record<AutofixExplorerStep, Record<string, unknown>>> = {
  root_cause: {one_line_description: 'The cache key collides across orgs', five_whys: []},
  solution: {
    one_line_summary: 'Seed the reduction with an initial accumulator',
    steps: [],
  },
};

/**
 * A run that has got as far as `lastStep`, with every step up to it recorded.
 * The last step is the one the run is on, so `status: 'error'` fails that step.
 * `pullRequest` adds a repo PR state; a failed create carries no PR number,
 * as the backend reports it.
 */
function makeRunThrough(
  lastStep: AutofixExplorerStep,
  {
    status = 'completed',
    pullRequest,
  }: {
    pullRequest?: 'creating' | 'completed' | 'error';
    status?: ExplorerAutofixState['status'];
  } = {}
): ExplorerAutofixState {
  const steps = STEP_ORDER.slice(0, STEP_ORDER.indexOf(lastStep) + 1);

  return {
    run_id: 42,
    status,
    updated_at: '2026-01-01T00:00:00Z',
    blocks: steps.map((step, index) => {
      const data = STEP_ARTIFACTS[step];
      return {
        id: `block-${index}`,
        timestamp: '2026-01-01T00:00:00Z',
        message: {
          role: 'assistant' as const,
          content: `Finished ${step}`,
          metadata: {step},
        },
        ...(data ? {artifacts: [{key: `artifact-${index}`, reason: 'Done', data}]} : {}),
      };
    }),
    ...(pullRequest
      ? {
          repo_pr_states: {
            'getsentry/sentry': {
              branch_name: 'seer/fix',
              commit_sha: 'abc123',
              pr_creation_error: pullRequest === 'error' ? 'Push rejected' : null,
              pr_creation_status: pullRequest,
              pr_id: pullRequest === 'error' ? null : 1,
              pr_number: pullRequest === 'error' ? null : 1,
              pr_url:
                pullRequest === 'error'
                  ? null
                  : 'https://github.com/getsentry/sentry/pull/1',
              repo_name: 'getsentry/sentry',
              title: 'Fix the cache key',
            },
          } satisfies ExplorerAutofixState['repo_pr_states'],
        }
      : {}),
  };
}

function mockRun(run: ExplorerAutofixState, asyncDelay?: Promise<void>) {
  return MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
    body: {autofix: run},
    asyncDelay,
  });
}

function AutofixRefFor({step}: {step: AutofixExplorerStep}) {
  return (
    <AutofixRef
      name="autofixRef"
      level="block"
      data={{id: GROUP_ID, shortId: 'JAVASCRIPT-1', runId: 42, step}}
    />
  );
}

/**
 * Two embeds of the same step, as a conversation that revisited the issue ends
 * up holding. `isBusy` lives in state so it can flip without a remount, the way
 * the chat provider flips it when the agent stops working.
 */
function DuplicateEmbeds({
  step,
  initiallyBusy = false,
}: {
  step: AutofixExplorerStep;
  initiallyBusy?: boolean;
}) {
  const [isBusy, setIsBusy] = useState(initiallyBusy);
  return (
    <Fragment>
      <button onClick={() => setIsBusy(false)}>agent settled</button>
      <AutofixChatProvider isBusy={isBusy} sendMessage={jest.fn()}>
        <AutofixRefFor step={step} />
        <AutofixRefFor step={step} />
      </AutofixChatProvider>
    </Fragment>
  );
}

/**
 * The embed shell renders collapsed, and a collapsed disclosure hides its
 * contents from role queries. Open every embed before looking for buttons.
 */
async function expandAll(count: number) {
  const triggers = await screen.findAllByRole('button', {expanded: false});
  expect(triggers).toHaveLength(count);
  for (const trigger of triggers) {
    await userEvent.click(trigger);
  }
}

function getButtons(name: string) {
  return screen.queryAllByRole('button', {name});
}

async function settleAgent() {
  await userEvent.click(screen.getByRole('button', {name: 'agent settled'}));
}

/**
 * Each step's embed offers one way forward. A step's copies must agree on it,
 * and stop offering it once the run holds the work it would start.
 */
const FORWARD_ACTIONS = [
  {
    step: 'root_cause',
    button: 'Continue: Plan',
    notStarted: () => makeRunThrough('root_cause'),
    started: () => makeRunThrough('solution'),
  },
  {
    step: 'solution',
    button: 'Continue: Code Changes',
    notStarted: () => makeRunThrough('solution'),
    started: () => makeRunThrough('code_changes'),
  },
  {
    step: 'code_changes',
    button: 'Draft a pull request',
    notStarted: () => makeRunThrough('code_changes'),
    started: () => makeRunThrough('code_changes', {pullRequest: 'completed'}),
  },
] as const;

describe('AutofixRef embed', () => {
  let issuesMock: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    issuesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      body: {runsByMilestone: {}},
    });
  });

  describe('polling', () => {
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

    it('refreshes the page behind it when the step result lands', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
        body: {autofix: makeRun('processing')},
      });

      render(<InboxBehindThePanel />, {organization});

      expect(await screen.findByText('Finding the root cause…')).toBeInTheDocument();
      await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(1));

      // The run finishes while the panel is open; the embed polls it up.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
        body: {autofix: makeRun('completed')},
      });

      await act(() => jest.advanceTimersByTimeAsync(1000));
      expect(
        await screen.findByText('The cache key collides across orgs')
      ).toBeInTheDocument();
      await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(2));
    });

    it('leaves the page alone while the step is still running', async () => {
      const autofixMock = MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
        body: {autofix: makeRun('processing')},
      });

      render(<InboxBehindThePanel />, {organization});

      expect(await screen.findByText('Finding the root cause…')).toBeInTheDocument();

      // Let the 1s status poll come round more than once: a partial result must
      // not yank the list out from under whoever is reading it.
      await act(() => jest.advanceTimersByTimeAsync(2000));
      expect(autofixMock).toHaveBeenCalledTimes(3);
      expect(issuesMock).toHaveBeenCalledTimes(1);
    });

    it('refreshes again when a pr_iteration embed swaps onto the PR section', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
        body: {autofix: makePrIterationRun({withPullRequest: false})},
      });

      render(<InboxBehindThePanel step="pr_iteration" />, {organization});

      // With no PR yet, the embed falls back to the completed code_changes
      // section, so it refreshes once on that.
      await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(2));

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
        body: {autofix: makePrIterationRun({withPullRequest: true})},
      });

      // The PR section is `completed` too, so only the section identity changes.
      // Keying the effect on status alone would sit still right here.
      // Queried by text, not role: the disclosure panel renders collapsed, so role
      // queries skip its contents as inaccessible.
      await act(() => jest.advanceTimersByTimeAsync(1000));
      expect(await screen.findByText('View getsentry/sentry#1')).toBeInTheDocument();
      await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(3));
    });
  });

  describe.each(FORWARD_ACTIONS)(
    'duplicate $step embeds',
    ({step, button, notStarted, started}) => {
      it('offers the next action from every copy until it starts', async () => {
        mockRun(notStarted());
        render(<DuplicateEmbeds step={step} />, {organization});
        await expandAll(2);

        const buttons = getButtons(button);
        expect(buttons).toHaveLength(2);
        for (const each of buttons) {
          expect(each).toBeEnabled();
        }
      });

      it('offers it from no copy once the run holds that work', async () => {
        mockRun(started());
        render(<DuplicateEmbeds step={step} />, {organization});
        await expandAll(2);

        expect(getButtons(button)).toHaveLength(0);
      });

      // The agent starts the work in the backend, so the run state still reads
      // as it did before the click. Without this the other copies stay live and
      // each click queues another prompt for work already underway.
      it('disables every copy while the agent is working', async () => {
        mockRun(notStarted());
        render(<DuplicateEmbeds step={step} initiallyBusy />, {organization});
        await expandAll(2);

        const buttons = getButtons(button);
        expect(buttons).toHaveLength(2);
        for (const each of buttons) {
          expect(each).toBeDisabled();
        }
      });

      // Between the agent settling and the refetch landing, the cached run state
      // still offers the work the agent just started.
      it('keeps every copy disabled until the post-agent refetch lands', async () => {
        mockRun(notStarted());
        render(<DuplicateEmbeds step={step} initiallyBusy />, {organization});
        await expandAll(2);

        let land!: () => void;
        mockRun(
          started(),
          new Promise(resolve => {
            land = resolve;
          })
        );
        await settleAgent();

        const buttons = getButtons(button);
        expect(buttons).toHaveLength(2);
        for (const each of buttons) {
          expect(each).toBeDisabled();
        }

        land();
        await waitFor(() => expect(getButtons(button)).toHaveLength(0));
      });
    }
  );

  it('offers the pull request again from every copy after a failed create', async () => {
    mockRun(makeRunThrough('code_changes', {pullRequest: 'error'}));
    render(<DuplicateEmbeds step="code_changes" />, {organization});
    await expandAll(2);

    const buttons = getButtons('Draft a pull request');
    expect(buttons).toHaveLength(2);
    for (const each of buttons) {
      expect(each).toBeEnabled();
    }
  });

  it('offers the pull request from no copy while one is being created', async () => {
    mockRun(makeRunThrough('code_changes', {pullRequest: 'creating'}));
    render(<DuplicateEmbeds step="code_changes" />, {organization});
    await expandAll(2);

    expect(getButtons('Draft a pull request')).toHaveLength(0);
  });

  it.each(STEP_ORDER)(
    'keeps a retry of a failed %s step in sync across copies',
    async step => {
      mockRun(makeRunThrough(step, {status: 'error'}));
      render(<DuplicateEmbeds step={step} initiallyBusy />, {organization});
      await expandAll(2);

      // Retried from one copy: both wait on the agent.
      const retries = getButtons('Try again');
      expect(retries).toHaveLength(2);
      for (const each of retries) {
        expect(each).toBeDisabled();
      }

      // The retry succeeds; once the agent settles, neither copy offers it.
      mockRun(makeRunThrough(step));
      await settleAgent();
      await waitFor(() => expect(getButtons('Try again')).toHaveLength(0));
    }
  );

  // One embed per step, as a conversation that walked the whole run holds.
  // Only the action the run has not taken yet is on offer, from one place.
  it('offers only the untaken action across a conversation spanning every step', async () => {
    mockRun(makeRunThrough('code_changes'));
    render(
      <AutofixChatProvider sendMessage={jest.fn()}>
        {STEP_ORDER.map(step => (
          <AutofixRefFor key={step} step={step} />
        ))}
      </AutofixChatProvider>,
      {organization}
    );
    await expandAll(3);

    expect(getButtons('Continue: Plan')).toHaveLength(0);
    expect(getButtons('Continue: Code Changes')).toHaveLength(0);
    expect(getButtons('Draft a pull request')).toHaveLength(1);
  });

  describe('out of Seer credits', () => {
    const creditCheckOrganization = OrganizationFixture({
      slug: 'org-slug',
      features: ['seer-credit-checks', 'token-billed-seer-enabled'],
    });
    const creditCheckUrl = `/organizations/${organization.slug}/seer/credit-check/`;

    // getsentry fills in the CTA; this stand-in shows what it was asked for.
    function StubOutOfCreditsCta({
      reason,
      variant = 'warning',
    }: SeerOutOfCreditsCtaProps) {
      return <div data-test-id="seer-out-of-credits-cta">{`${variant} ${reason}`}</div>;
    }

    beforeEach(() => {
      registerOverride('component:seer-out-of-credits-cta', () => StubOutOfCreditsCta);
    });

    it.each([
      {step: 'root_cause', button: 'Continue: Plan', operation: 'autofix_solution'},
      {
        step: 'solution',
        button: 'Continue: Code Changes',
        operation: 'autofix_code_changes',
      },
      {
        step: 'code_changes',
        button: 'Draft a pull request',
        operation: 'autofix_open_pr',
      },
    ] as const)(
      'outside the Explorer chat, shows the CTA above a disabled $button',
      async ({step, button, operation}) => {
        mockRun(makeRunThrough(step));
        const creditCheck = MockApiClient.addMockResponse({
          url: creditCheckUrl,
          match: [MockApiClient.matchQuery({operation})],
          body: {hasEnoughCredits: false},
        });

        render(
          <AutofixChatProvider sendMessage={jest.fn()}>
            <AutofixRefFor step={step} />
          </AutofixChatProvider>,
          {organization: creditCheckOrganization}
        );
        await expandAll(1);

        const cta = await screen.findByTestId('seer-out-of-credits-cta');
        expect(cta).toHaveTextContent('muted autofix-continue');
        expect(getButtons(button)).toHaveLength(1);
        expect(getButtons(button)[0]).toBeDisabled();
        expect(
          cta.compareDocumentPosition(getButtons(button)[0]!) &
            Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(creditCheck).toHaveBeenCalledTimes(1);
      }
    );

    it('keeps the step result visible', async () => {
      mockRun(makeRunThrough('root_cause'));
      MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });

      render(
        <AutofixChatProvider sendMessage={jest.fn()}>
          <AutofixRefFor step="root_cause" />
        </AutofixChatProvider>,
        {organization: creditCheckOrganization}
      );
      await expandAll(1);

      expect(await screen.findByTestId('seer-out-of-credits-cta')).toBeInTheDocument();
      expect(screen.getByText('The cache key collides across orgs')).toBeInTheDocument();
    });

    it('offers the next step when the org can afford it', async () => {
      mockRun(makeRunThrough('root_cause'));
      MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: true},
      });

      render(
        <AutofixChatProvider sendMessage={jest.fn()}>
          <AutofixRefFor step="root_cause" />
        </AutofixChatProvider>,
        {organization: creditCheckOrganization}
      );
      await expandAll(1);

      await waitFor(() => expect(getButtons('Continue: Plan')[0]).toBeEnabled());
      expect(screen.queryByTestId('seer-out-of-credits-cta')).not.toBeInTheDocument();
    });

    it('leaves the CTA to the Explorer chat, where the composer shows it', async () => {
      mockRun(makeRunThrough('root_cause'));
      MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });
      const reportOutOfCredits = jest.fn();

      const {unmount} = render(
        <AutofixChatProvider
          sendMessage={jest.fn()}
          reportOutOfCredits={reportOutOfCredits}
        >
          <AutofixRefFor step="root_cause" />
        </AutofixChatProvider>,
        {organization: creditCheckOrganization}
      );
      await expandAll(1);

      await waitFor(() =>
        expect(reportOutOfCredits).toHaveBeenLastCalledWith(
          expect.any(String),
          true,
          null
        )
      );
      expect(getButtons('Continue: Plan')[0]).toBeDisabled();
      expect(screen.queryByTestId('seer-out-of-credits-cta')).not.toBeInTheDocument();

      // A card that leaves the chat takes its report with it.
      const [embedId] = reportOutOfCredits.mock.lastCall!;
      unmount();
      expect(reportOutOfCredits).toHaveBeenLastCalledWith(embedId, false, null);
    });

    it('reports nothing to the Explorer chat when the org can afford the step', async () => {
      mockRun(makeRunThrough('root_cause'));
      MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: true},
      });
      const reportOutOfCredits = jest.fn();

      render(
        <AutofixChatProvider
          sendMessage={jest.fn()}
          reportOutOfCredits={reportOutOfCredits}
        >
          <AutofixRefFor step="root_cause" />
        </AutofixChatProvider>,
        {organization: creditCheckOrganization}
      );
      await expandAll(1);

      await waitFor(() => expect(getButtons('Continue: Plan')[0]).toBeEnabled());
      expect(reportOutOfCredits).not.toHaveBeenCalledWith(expect.any(String), true, null);
    });

    it('offers no next step for a single run, so checks nothing', async () => {
      mockRun({
        run_id: 42,
        feature_id: 'autofix_single_run',
        status: 'completed',
        updated_at: '2026-01-01T00:00:00Z',
        blocks: [
          {
            id: 'block-0',
            timestamp: '2026-01-01T00:00:00Z',
            message: {role: 'assistant', content: 'done', metadata: {step: 'single_run'}},
            artifacts: [
              {
                key: 'single_run_root_cause',
                reason: 'found',
                data: {headline: 'Divides by zero', cause: 'Empty weights.'},
              },
            ],
          },
        ],
      });
      const creditCheck = MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });
      const reportOutOfCredits = jest.fn();

      render(
        <AutofixChatProvider
          sendMessage={jest.fn()}
          reportOutOfCredits={reportOutOfCredits}
        >
          <AutofixRefFor step="root_cause" />
        </AutofixChatProvider>,
        {organization: creditCheckOrganization}
      );
      await expandAll(1);

      expect(await screen.findByText('Divides by zero')).toBeInTheDocument();
      expect(getButtons('Continue: Plan')).toHaveLength(0);
      expect(creditCheck).not.toHaveBeenCalled();
      expect(reportOutOfCredits).not.toHaveBeenCalledWith(expect.any(String), true, null);
    });

    it('does not check credits in a read-only conversation', async () => {
      mockRun(makeRunThrough('root_cause'));
      const creditCheck = MockApiClient.addMockResponse({
        url: creditCheckUrl,
        body: {hasEnoughCredits: false},
      });

      render(<AutofixRefFor step="root_cause" />, {
        organization: creditCheckOrganization,
      });
      await expandAll(1);

      expect(getButtons('Continue: Plan')).toHaveLength(1);
      expect(screen.queryByTestId('seer-out-of-credits-cta')).not.toBeInTheDocument();
      expect(creditCheck).not.toHaveBeenCalled();
    });
  });
});

const ISSUE = {id: '6789012345', shortId: 'CHECKOUT-42'};

function renderAutofixEmbed(data: Record<string, unknown>) {
  const tag = `{% autofix %}${JSON.stringify({...ISSUE, ...data})}{% /autofix %}`;
  return render(<SeerMarkdown raw={tag} />);
}

async function expand(name: string) {
  await userEvent.click(screen.getByRole('button', {name: new RegExp(name)}));
}

describe('autofix embed', () => {
  it('renders in the shared block shell', () => {
    renderAutofixEmbed({
      step: 'root_cause',
      result: 'The cart total throws on an empty cart.',
    });

    expect(screen.getByTestId('seer-autofix-embed')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Root Cause'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.getByRole('link', {name: 'CHECKOUT-42'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/${ISSUE.id}/`
    );
    expect(
      screen.queryByText('The cart total throws on an empty cart.')
    ).not.toBeVisible();
  });

  it('renders the root cause sections a live run shows', async () => {
    renderAutofixEmbed({
      step: 'root_cause',
      result: '`CartService.total()` reduces line items without an initial accumulator.',
      fiveWhys: [
        '`POST /api/checkout/quote` returned a 500 for every empty cart.',
        'The empty-cart path was never exercised by a test.',
      ],
      reproductionSteps: ['Empty the cart.', 'Open `/checkout`.'],
    });

    await expand('Root Cause');

    expect(
      screen.getByText(/reduces line items without an initial accumulator/)
    ).toBeInTheDocument();

    expect(screen.getByText('Why did this happen?')).toBeInTheDocument();
    expect(screen.getByText(/returned a 500 for every empty cart/)).toBeInTheDocument();

    expect(screen.getByText('Reproduction Steps')).toBeInTheDocument();
    expect(screen.getByText('Empty the cart.')).toBeInTheDocument();
  });

  it('renders long plan content across multiple list items', async () => {
    const longFilename =
      'src/components/checkout/ThisFilenameIsLongEnoughToOverflowTheAutofixContentPanel.tsx';
    renderAutofixEmbed({
      step: 'solution',
      result: `Update ${longFilename}.`,
      steps: [
        {
          title: 'Pass an initial accumulator',
          description: `Add the guard in ${longFilename}.`,
        },
        {
          title: 'Cover the regression',
          description: `Add a test for ${longFilename}.`,
        },
      ],
    });

    await expand('Plan');

    expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
    const list = screen.getByText('Pass an initial accumulator').closest('ol');
    expect(list).toContainElement(screen.getByText('Cover the regression'));
    expect(screen.getByText(`Update ${longFilename}.`).closest('p')).toBeInTheDocument();
    expect(screen.getByText(`Add the guard in ${longFilename}.`)).toBeInTheDocument();
  });

  // Seer writes this embed itself, so the structured fields can be absent even
  // on a step that normally carries them.
  it('renders the summary alone when no structured detail is sent', async () => {
    renderAutofixEmbed({
      step: 'root_cause',
      result: 'The cart total throws on an empty cart.',
    });

    await expand('Root Cause');

    expect(
      screen.getByText('The cart total throws on an empty cart.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Why did this happen?')).not.toBeInTheDocument();
    expect(screen.queryByText('Reproduction Steps')).not.toBeInTheDocument();
  });
});
