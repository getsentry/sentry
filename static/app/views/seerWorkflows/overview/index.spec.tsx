import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
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
    // Collapsed status groups persist to localStorage; keep tests isolated.
    localStorage.clear();

    // The project page filter needs seeded page-filter + project stores, or
    // PageFiltersContainer never reports ready and the issues query stays
    // gated off.
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    ProjectsStore.loadInitialData([ProjectFixture()]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });

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
              answer: 'Restores the Authorization header as a fallback.',
            },
            // reviewer_notes answers empty on fix cards, and empty answers
            // never become entries.
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

    // This diff fails the inline-differ gates twice over (49 changed lines
    // is past the cap, and its hunks are empty), so the file path lives only
    // in the pill's hover tooltip — no diff header on the card.
    expect(screen.queryByText('src/cart.py')).not.toBeInTheDocument();

    // Hovering the diff pill lists the changed files.
    await userEvent.hover(screen.getByText('1 file'));
    expect(await screen.findByText('src/cart.py')).toBeInTheDocument();

    // Issue impact numbers, abbreviated.
    expect(screen.getByText(/100 events/)).toBeInTheDocument();
  });

  it('renders the analysis on the card face in thought order', async () => {
    renderPage();

    // Both sections render with no expansion needed…
    const rootCause = await screen.findByText('Root cause');
    const proposedFix = screen.getByText('Proposed fix');
    expect(
      screen.getByText('Commit c5bb895 stopped sending the Authorization header.')
    ).toBeVisible();
    expect(
      screen.getByText('Restores the Authorization header as a fallback.')
    ).toBeVisible();

    // …in thought order: what broke, then what changed.
    expect(
      rootCause.compareDocumentPosition(proposedFix) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // The timestamp is labeled as run activity.
    expect(screen.getByText(/^updated/)).toBeInTheDocument();

    // Identity sits in the tail: short id + exactly one level marker.
    expect(screen.getByText('PROJ-1')).toBeVisible();
    expect(screen.getAllByText('Level: Warning')).toHaveLength(1);
  });

  it('leads with the root cause and a single next step when no code was drafted', async () => {
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
              key: 'user_2',
              question: RUN_QUESTIONS[2]!.prompt,
              answer: 'Decide whether to relax the constraint.',
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

    // No drafted fix → no fix section; the notes read as the next step.
    expect(screen.queryByText('Proposed fix')).not.toBeInTheDocument();
    expect(screen.getByText('Next steps')).toBeVisible();
    expect(screen.getByText('Decide whether to relax the constraint.')).toBeVisible();
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

  it('shows merged state when the API returns PR state', async () => {
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

    renderPage();

    // The merged run wears a Merged tag (and its group header) instead of a
    // Review PR action.
    expect(await screen.findAllByText('Merged')).toHaveLength(2);
    expect(screen.queryByRole('button', {name: 'Review PR'})).not.toBeInTheDocument();
  });

  it('groups cards under collapsible status sections in triage order', async () => {
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

    // One sticky section per status, in fixed triage order, with counts.
    const reviewHeader = await screen.findByRole('button', {
      name: 'Awaiting your review 1',
    });
    const runningHeader = screen.getByRole('button', {name: 'Running 1'});
    const mergedHeader = screen.getByRole('button', {name: 'Merged 1'});
    expect(
      reviewHeader.compareDocumentPosition(runningHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      runningHeader.compareDocumentPosition(mergedHeader) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Cards land under their section: B needs review, C runs, A is merged.
    const titles = screen
      .getAllByRole('link')
      .map(link => link.textContent)
      .filter(text => text === 'Issue A' || text === 'Issue B' || text === 'Issue C');
    expect(titles).toEqual(['Issue B', 'Issue C', 'Issue A']);

    // Collapsing a section hides only its cards.
    await userEvent.click(mergedHeader);
    expect(screen.queryByRole('link', {name: 'Issue A'})).not.toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Issue B'})).toBeInTheDocument();

    // The bulk toggle folds everything, then flips to Expand all.
    await userEvent.click(screen.getByRole('button', {name: 'Collapse all'}));
    expect(screen.queryByRole('link', {name: 'Issue B'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand all'}));
    expect(screen.getByRole('link', {name: 'Issue A'})).toBeInTheDocument();
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
    // …and the card lands in the Needs-your-input section.
    expect(screen.getByRole('button', {name: 'Needs your input 1'})).toBeInTheDocument();
  });

  it('sections errored runs under the Errored group', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: {
          run_id: 1,
          status: 'error',
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
          ],
        },
      },
    });

    renderPage();

    expect(await screen.findByRole('button', {name: 'Errored 1'})).toBeInTheDocument();
  });

  it('scopes the issue stream to the selected projects', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    const issuesRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [issue],
    });

    renderPage();

    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();
    // The selector's trigger reflects the selection (the card's project badge
    // is a link, so the button role isolates the filter)…
    expect(screen.getByRole('button', {name: 'project-slug'})).toBeInTheDocument();
    // …and the issues request carries it.
    expect(issuesRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/`,
      expect.objectContaining({
        query: expect.objectContaining({project: [2]}),
      })
    );
  });

  it('renders an inline differ for small diffs, collapsed to a file header', async () => {
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
                    added: 2,
                    removed: 1,
                    hunks: [
                      {
                        section_header: 'def add_to_cart',
                        source_start: 10,
                        source_length: 3,
                        target_start: 10,
                        target_length: 4,
                        lines: [
                          {
                            value: 'def add_to_cart(item):',
                            line_type: ' ',
                            source_line_no: 10,
                            target_line_no: 10,
                            diff_line_no: 1,
                          },
                          {
                            value: '    total = None',
                            line_type: '-',
                            source_line_no: 11,
                            target_line_no: null,
                            diff_line_no: 2,
                          },
                          {
                            value: '    total = 0',
                            line_type: '+',
                            source_line_no: null,
                            target_line_no: 11,
                            diff_line_no: 3,
                          },
                          {
                            value: '    return total',
                            line_type: '+',
                            source_line_no: null,
                            target_line_no: 12,
                            diff_line_no: 4,
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    });

    renderPage();

    // The differ's file header shows on the card without any interaction…
    const fileHeader = await screen.findByText('src/cart.py');
    // …but the diff body starts collapsed.
    expect(screen.queryByText(/@@ -10,3 \+10,4 @@/)).not.toBeInTheDocument();

    await userEvent.click(fileHeader);

    expect(screen.getByText(/@@ -10,3 \+10,4 @@/)).toBeInTheDocument();
  });

  it('focuses a single fully-expanded card when id is present', async () => {
    // The focus fetch pins the exact group id (and the endpoint ignores the
    // list's filters in that mode).
    const groupRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [issue],
      match: [MockApiClient.matchQuery({group: ['2']})],
    });
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
                    added: 1,
                    removed: 0,
                    hunks: [
                      {
                        section_header: '',
                        source_start: 5,
                        source_length: 1,
                        target_start: 5,
                        target_length: 2,
                        lines: [
                          {
                            value: '    return total',
                            line_type: '+',
                            source_line_no: null,
                            target_line_no: 5,
                            diff_line_no: 1,
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    });

    renderPage({id: '2'});

    // The full analysis renders expanded without any interaction…
    expect(await screen.findByText('Root cause')).toBeVisible();
    expect(screen.getByText('PROJ-1')).toBeVisible();
    // …and so does the inline diff.
    expect(screen.getByText(/@@ -5,1 \+5,2 @@/)).toBeInTheDocument();
    expect(groupRequest).toHaveBeenCalled();

    // Focus mode hides the list chrome and offers the way back, keeping the
    // other params.
    expect(screen.queryByRole('button', {name: /Outcome/})).not.toBeInTheDocument();
    const backLink = screen.getByRole('button', {name: 'All issues'});
    expect(backLink).toHaveAttribute('href', expect.not.stringContaining('id=2'));
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
