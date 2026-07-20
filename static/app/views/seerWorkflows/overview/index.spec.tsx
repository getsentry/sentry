import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import AutofixOverview from 'sentry/views/seerWorkflows/overview';
import {RUN_QUESTIONS} from 'sentry/views/seerWorkflows/overview/runQuestions';

describe('AutofixOverview', () => {
  const organization = OrganizationFixture({
    features: ['seer-night-shift-ui'],
  });
  const basePath = `/organizations/${organization.slug}/issues/autofix/overview/`;

  const issue = GroupFixture({
    id: '2',
    shortId: 'PROJ-1',
    title: 'TypeError in checkout cart',
    count: '100',
    userCount: 5,
    seerFixabilityScore: 0.75,
  });

  // A run that reached every stage and opened a PR.
  const autofixState = {
    run_id: 1,
    status: 'completed',
    updated_at: '2026-07-14T10:00:00Z',
    blocks: [
      {
        id: 'b1',
        timestamp: '2026-07-14T09:00:00Z',
        message: {
          role: 'assistant',
          content: 'rca',
          metadata: {step: 'root_cause'},
        },
      },
      {
        id: 'b2',
        timestamp: '2026-07-14T09:10:00Z',
        message: {
          role: 'assistant',
          content: 'plan',
          metadata: {step: 'solution'},
        },
      },
      {
        id: 'b3',
        timestamp: '2026-07-14T09:20:00Z',
        message: {
          role: 'assistant',
          content: 'code',
          metadata: {step: 'code_changes'},
        },
        merged_file_patches: [
          {
            repo_name: 'getsentry/sentry',
            diff: '--- a/src/cart.py\n+++ b/src/cart.py',
            patch: {
              path: 'src/cart.py',
              source_file: 'src/cart.py',
              target_file: 'src/cart.py',
              type: 'M',
              added: 42,
              removed: 7,
              hunks: [],
            },
          },
        ],
      },
    ],
    repo_pr_states: {
      'getsentry/sentry': {
        repo_name: 'getsentry/sentry',
        branch_name: 'fix/cart',
        commit_sha: null,
        pr_creation_error: null,
        pr_creation_status: 'completed',
        pr_id: null,
        pr_number: 123,
        pr_url: 'https://github.com/getsentry/sentry/pull/123',
        title: 'Fix nil cart',
      },
    },
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [issue],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        {
          id: 'run-1',
          type: 'explorer',
          groupId: '2',
          source: 'night_shift',
          lastTriggeredAt: '2026-07-14T09:00:00Z',
          dateCreated: '2026-07-14T09:00:00Z',
          outputs: [
            {
              key: 'user_0',
              question: RUN_QUESTIONS[0]!.prompt,
              answer:
                'Proxy requests fail without Authorization header|Commit c5bb895 stopped sending the Authorization header.',
            },
            {
              key: 'user_1',
              question: RUN_QUESTIONS[1]!.prompt,
              answer:
                'JWT viewer auth landed before the proxy supported it, so requests fail; the run opened a PR restoring the header.',
            },
            {
              key: 'user_2',
              question: RUN_QUESTIONS[2]!.prompt,
              answer: 'Restores the Authorization header as a fallback.',
            },
            {
              key: 'user_3',
              question: RUN_QUESTIONS[3]!.prompt,
              // Inline "•" bullets — the normalizer must split them into a list.
              answer:
                '• Confirm the fallback header does not leak the key. • Verify the proxy accepts both headers.',
            },
          ],
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {autofix: autofixState},
    });
  });

  function renderPage(query: Record<string, string> = {}) {
    return render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath, query}},
    });
  }

  it('gates the page behind the seer-night-shift-ui feature', () => {
    render(<AutofixOverview />, {
      organization: OrganizationFixture({features: []}),
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(screen.getByText("You don't have access to this feature")).toBeInTheDocument();
    expect(screen.queryByText('Autofix Overview')).not.toBeInTheDocument();
  });

  it('renders a card with real run metadata', async () => {
    renderPage();

    // The Seer headline replaces the raw issue title and links to the issue.
    const titleLink = await screen.findByRole('link', {
      name: 'Proxy requests fail without Authorization header',
    });
    expect(titleLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/2/`
    );
    // night_shift source maps to the Workflow trigger badge.
    expect(screen.getByText('Workflow')).toBeInTheDocument();

    // An opened PR reads as needing review and links out to the PR; the PR
    // number lives in the tooltip, not the label.
    expect(screen.getByRole('button', {name: 'Review PR'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/123'
    );

    // Exact patch stats from merged_file_patches, not an LLM estimate.
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(screen.getByText('+42')).toBeInTheDocument();
    expect(screen.getByText('−7')).toBeInTheDocument();

    // Hovering the diff pill lists the changed files.
    await userEvent.hover(screen.getByText('1 file'));
    expect(await screen.findByText('src/cart.py')).toBeInTheDocument();

    // Issue impact numbers, abbreviated.
    expect(screen.getByText(/100 events/)).toBeInTheDocument();
  });

  it('shows a single body block and collapses the full analysis', async () => {
    renderPage();

    // The body is either/or: code was drafted, so the proposed-fix block
    // renders and the summary does not (it would describe the same change).
    expect(await screen.findByText('Proposed fix')).toBeVisible();
    expect(
      screen.getByText('Restores the Authorization header as a fallback.')
    ).toBeVisible();
    expect(
      screen.queryByText(
        'JWT viewer auth landed before the proxy supported it, so requests fail; the run opened a PR restoring the header.'
      )
    ).not.toBeInTheDocument();

    // The timestamp is labeled as run activity.
    expect(screen.getByText(/^updated/)).toBeInTheDocument();

    // Root cause, notes, and the short id stay behind the disclosure.
    const disclosure = screen.getByRole('button', {name: 'Full analysis'});
    expect(
      screen.getByText('Commit c5bb895 stopped sending the Authorization header.')
    ).not.toBeVisible();
    expect(screen.getByText('PROJ-1')).not.toBeVisible();

    await userEvent.click(disclosure);

    expect(screen.getByText('PROJ-1')).toBeVisible();
    // Section headings are the clean labels, never the raw prompt text.
    expect(screen.getByText('Root cause')).toBeVisible();
    expect(
      screen.getByText('Commit c5bb895 stopped sending the Authorization header.')
    ).toBeVisible();
    // Code was drafted, so the notes section is a review checklist, with the
    // inline-bullet answer normalized into separate list items.
    expect(screen.getByText('Review checklist')).toBeVisible();
    expect(
      screen.getByText('Confirm the fallback header does not leak the key.')
    ).toBeVisible();
    expect(screen.getByText('Verify the proxy accepts both headers.')).toBeVisible();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
    // Fixability lives in the expanded state as a bucketed tag (0.75 > 0.7).
    expect(screen.getByText('High fixability')).toBeVisible();
  });

  it('shows Diagnosis and Next steps when no code was drafted', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        {
          id: 'run-1',
          type: 'explorer',
          groupId: '2',
          source: 'autofix',
          lastTriggeredAt: '2026-07-14T09:00:00Z',
          dateCreated: '2026-07-14T09:00:00Z',
          outputs: [
            {
              key: 'user_1',
              question: RUN_QUESTIONS[1]!.prompt,
              answer: 'A mechanism sentence without any drafted fix.',
            },
            {
              key: 'user_3',
              question: RUN_QUESTIONS[3]!.prompt,
              answer: '- Decide whether Seer should generate a fix.',
            },
          ],
        },
      ],
    });

    renderPage();

    // No headline answer → the raw issue title renders.
    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    // No drafted fix → the body block is the Diagnosis variant.
    expect(screen.getByText('Diagnosis')).toBeVisible();
    expect(
      screen.getByText('A mechanism sentence without any drafted fix.')
    ).toBeVisible();
    expect(screen.queryByText('Proposed fix')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Full analysis'}));

    // …and the notes section is Next steps rather than a review checklist.
    expect(screen.getByText('Next steps')).toBeVisible();
    expect(screen.getByText('Decide whether Seer should generate a fix.')).toBeVisible();
    expect(screen.queryByText('Review checklist')).not.toBeInTheDocument();
  });

  it('toggles quick filters from the stat cards via the URL', async () => {
    const {router} = renderPage();

    // Wait for the card to load so the stat counts reflect the row.
    expect(await screen.findByRole('button', {name: 'Review PR'})).toBeInTheDocument();

    // The PR-opened row counts toward "Awaiting your review".
    const statCard = screen.getByRole('button', {
      name: /Awaiting your review/,
    });
    expect(statCard).toHaveTextContent('1');

    await userEvent.click(statCard);
    expect(router.location.query.quick).toBe('review_pr');

    await userEvent.click(statCard);
    expect(router.location.query.quick).toBeUndefined();
  });

  it('applies the outcome filter with AND semantics', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: '2026-07-14T10:00:00Z',
          blocks: [
            {
              id: 'b1',
              timestamp: '2026-07-14T09:00:00Z',
              message: {
                role: 'assistant',
                content: 'rca',
                metadata: {step: 'root_cause'},
              },
            },
          ],
        },
      },
    });

    renderPage();

    const title = 'Proxy requests fail without Authorization header';
    expect(await screen.findByRole('link', {name: title})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: /Outcome/}));

    await userEvent.click(screen.getByRole('option', {name: 'Root cause'}));
    expect(await screen.findByRole('link', {name: title})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('option', {name: 'Code changes'}));
    expect(await screen.findByText('No issues match your filters.')).toBeInTheDocument();
  });

  it('falls back to a View run action when nothing needs attention', async () => {
    // A run that only found a root cause: no attention reason, but the card
    // should still offer a way into the run (Seer drawer deep link).
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'completed',
          updated_at: '2026-07-14T10:00:00Z',
          blocks: [
            {
              id: 'b1',
              timestamp: '2026-07-14T09:00:00Z',
              message: {
                role: 'assistant',
                content: 'rca',
                metadata: {step: 'root_cause'},
              },
            },
          ],
        },
      },
    });

    renderPage();

    const viewRun = await screen.findByRole('button', {name: 'View run'});
    expect(viewRun).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/2/?seerDrawer=true`
    );
  });

  it('shows merged state and enables the Merged PRs card when the API returns PR state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        {
          id: 'run-1',
          type: 'explorer',
          groupId: '2',
          source: 'autofix',
          lastTriggeredAt: '2026-07-14T09:00:00Z',
          dateCreated: '2026-07-14T09:00:00Z',
          pullRequests: [{status: 'merged', mergedAt: '2026-07-15T09:00:00Z'}],
          outputs: [],
        },
      ],
    });

    const {router} = renderPage();

    // The merged run wears a Merged tag instead of a Review PR action.
    expect(await screen.findByText('Merged')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Review PR'})).not.toBeInTheDocument();

    // The Merged PRs stat card is live and counts the row.
    const mergedCard = screen.getByRole('button', {name: /Merged PRs/});
    expect(mergedCard).toBeEnabled();
    expect(mergedCard).toHaveTextContent('1');

    await userEvent.click(mergedCard);
    expect(router.location.query.quick).toBe('merged');
  });

  it('orders cards as a triage queue: actionable, then working, then merged', async () => {
    // A merged, B awaiting PR review, C still processing → B, C, A.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [
        GroupFixture({id: '2', title: 'Issue A'}),
        GroupFixture({id: '3', title: 'Issue B'}),
        GroupFixture({id: '4', title: 'Issue C'}),
      ],
    });
    const runFor = (groupId: string, pullRequests: unknown[]) => ({
      id: `run-${groupId}`,
      type: 'explorer',
      groupId,
      source: 'autofix',
      lastTriggeredAt: '2026-07-14T09:00:00Z',
      dateCreated: '2026-07-14T09:00:00Z',
      pullRequests,
      outputs: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        runFor('2', [{status: 'merged', mergedAt: '2026-07-15T09:00:00Z'}]),
        runFor('3', []),
        runFor('4', []),
      ],
    });
    // A and B both reached an opened PR; A's merged flag comes from its run.
    for (const issueId of ['2', '3']) {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${issueId}/autofix/`,
        body: {autofix: autofixState},
      });
    }
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/4/autofix/`,
      body: {
        autofix: {...autofixState, status: 'processing', repo_pr_states: {}},
      },
    });

    renderPage();

    expect(await screen.findByText('Merged')).toBeInTheDocument();
    const titles = screen
      .getAllByRole('link')
      .map(link => link.textContent)
      .filter(text => text === 'Issue A' || text === 'Issue B' || text === 'Issue C');
    expect(titles).toEqual(['Issue B', 'Issue C', 'Issue A']);
  });

  it('always enables the Merged PRs card, showing 0 when nothing is merged', async () => {
    renderPage();

    const mergedCard = await screen.findByRole('button', {name: /Merged PRs/});
    expect(mergedCard).toBeEnabled();
    expect(mergedCard).toHaveTextContent('0');
  });

  it('surfaces the blocking question when a run awaits user input', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'awaiting_user_input',
          updated_at: '2026-07-14T10:00:00Z',
          blocks: [
            {
              id: 'b1',
              timestamp: '2026-07-14T09:00:00Z',
              message: {
                role: 'assistant',
                content: 'rca',
                metadata: {step: 'root_cause'},
              },
            },
          ],
          // Canonical ask_user_question shape: the text is nested under
          // questions[0].question, not a flat key.
          pending_user_input: {
            id: 'input-1',
            input_type: 'ask_user_question',
            data: {
              questions: [{question: 'Which environment should I target?', options: []}],
            },
          },
        },
      },
    });

    renderPage();

    expect(
      await screen.findByText('Seer asked: Which environment should I target?')
    ).toBeInTheDocument();
  });

  it('normalizes space-less • bullets into a markdown list', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        {
          id: 'run-1',
          type: 'explorer',
          groupId: '2',
          source: 'autofix',
          lastTriggeredAt: '2026-07-14T09:00:00Z',
          dateCreated: '2026-07-14T09:00:00Z',
          outputs: [
            {
              key: 'user_3',
              question: RUN_QUESTIONS[3]!.prompt,
              // No space after the • — the normalizer must still split these.
              answer: '•Confirm the header is not leaked. •Verify both headers work.',
            },
          ],
        },
      ],
    });

    renderPage();

    await userEvent.click(await screen.findByRole('button', {name: 'Full analysis'}));

    expect(screen.getByText('Confirm the header is not leaked.')).toBeVisible();
    expect(screen.getByText('Verify both headers work.')).toBeVisible();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('renders an error state and can retry', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });
});
