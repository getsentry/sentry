import {Fragment, useState} from 'react';
import {useInfiniteQuery} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {
  AutofixExplorerStep,
  ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixChatProvider} from 'sentry/components/seer/autofixChatContext';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {AutofixRef} from 'sentry/components/seer/markdown/embeds/components/autofix';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

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

    expect(
      await screen.findByText('The cache key collides across orgs', undefined, {
        timeout: 5000,
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(2));
  }, 20_000);

  it('leaves the page alone while the step is still running', async () => {
    const autofixMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
      body: {autofix: makeRun('processing')},
    });

    render(<InboxBehindThePanel />, {organization});

    expect(await screen.findByText('Finding the root cause…')).toBeInTheDocument();

    // Let the 1s status poll come round more than once: a partial result must
    // not yank the list out from under whoever is reading it.
    await waitFor(() => expect(autofixMock).toHaveBeenCalledTimes(3), {timeout: 5000});
    expect(issuesMock).toHaveBeenCalledTimes(1);
  }, 20_000);

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
    expect(
      await screen.findByText('View getsentry/sentry#1', undefined, {timeout: 5000})
    ).toBeInTheDocument();
    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(3));
  }, 20_000);
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

  it('renders the plan steps', async () => {
    renderAutofixEmbed({
      step: 'solution',
      result: 'Seed the reduction with `0`.',
      steps: [
        {
          title: 'Pass an initial accumulator',
          description: 'Pass `0` as the second argument to `reduce`.',
        },
      ],
    });

    await expand('Plan');

    expect(screen.getByText('Steps to Resolve')).toBeInTheDocument();
    expect(screen.getByText('Pass an initial accumulator')).toBeInTheDocument();
    expect(
      screen.getByText('Pass `0` as the second argument to `reduce`.')
    ).toBeInTheDocument();
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
