import {GroupFixture} from 'sentry-fixture/group';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TeamStore} from 'sentry/stores/teamStore';
import AutofixOverview from 'sentry/views/seerWorkflows/overview';
import {
  RUN_QUESTION_PROMPTS,
  RUN_QUESTIONS,
} from 'sentry/views/seerWorkflows/overview/runQuestions';

describe('AutofixOverview', () => {
  const organization = OrganizationFixture({
    features: ['seer-night-shift-ui'],
  });
  const basePath = `/organizations/${organization.slug}/issues/autofix/overview/`;

  // The five status buckets the page always renders, in fixed order. Each is
  // one GET /issues/ differentiated only by its `query` filter, so section
  // mocks are matched on that string.
  const SECTION_QUERIES = {
    review_pr: 'has:issue.seer_last_run issue.autofix_state:review_pr',
    code_changes_ready: 'has:issue.seer_last_run issue.autofix_state:code_changes_ready',
    solution_ready: 'has:issue.seer_last_run issue.autofix_state:solution_ready',
    needs_investigation:
      'has:issue.seer_last_run issue.autofix_state:needs_investigation',
    merged: 'has:issue.seer_last_run issue.autofix_state:merged',
  };

  const issue = GroupFixture({
    id: '2',
    shortId: 'PROJ-1',
    title: 'TypeError in checkout cart',
    count: '100',
    userCount: 5,
  });

  // One answered run question keyed to its prompt (the endpoint echoes the
  // prompt back), so buildAnalysis joins it to its question config by text.
  function makeOutput(questionIndex: number, answer: string) {
    return {question: RUN_QUESTIONS[questionIndex]!.prompt, answer};
  }

  // A pipeline block. Only `message.metadata.step` (section bucketing),
  // `message.role`/`content` (section completion), and `merged_file_patches`
  // (the diff artifact) are read, so the builder carries just those.
  function makeBlock(step: string, overrides: Record<string, unknown> = {}) {
    return {message: {role: 'assistant', content: step, metadata: {step}}, ...overrides};
  }

  // The per-card runs payload: a night_shift-triggered run whose one-shot
  // answers become the card's Root cause / Proposed fix prose. Tests spread
  // overrides to vary source, outputs, or linked PRs.
  function makeRun(overrides: Record<string, unknown> = {}) {
    return {
      id: 'run-1',
      groupId: '2',
      source: 'night_shift',
      lastTriggeredAt: '2026-07-14T09:00:00Z',
      outputs: [
        makeOutput(
          0,
          'Proxy requests fail without Authorization header|Commit c5bb895 stopped sending the Authorization header.'
        ),
        makeOutput(1, 'Restores the Authorization header as a fallback.'),
      ],
      ...overrides,
    };
  }

  // A run that reached every stage and opened a PR. Tests spread overrides to
  // vary status, blocks, the pending-input payload, or the PR states.
  function makeAutofixState(overrides: Record<string, unknown> = {}) {
    return {
      run_id: 1,
      status: 'completed',
      updated_at: '2026-07-14T10:00:00Z',
      blocks: [
        makeBlock('root_cause'),
        makeBlock('solution'),
        makeBlock('code_changes', {
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
        }),
      ],
      repo_pr_states: {
        'getsentry/sentry': {
          repo_name: 'getsentry/sentry',
          pr_creation_status: 'completed',
          pr_number: 123,
          pr_url: 'https://github.com/getsentry/sentry/pull/123',
        },
      },
      ...overrides,
    };
  }

  // The repo-wide IntersectionObserver mock (tests/js/setup.ts) is a no-op
  // whose observe() never fires its callback, so LazyRender content would
  // stay hidden forever. Report every observed node as immediately
  // intersecting so cards hydrate the way they would once scrolled into view.
  const OriginalIntersectionObserver = window.IntersectionObserver;
  beforeAll(() => {
    window.IntersectionObserver = class MockIntersectionObserver {
      root = null;
      rootMargin = '';
      scrollMargin = '';
      thresholds = [];
      takeRecords = jest.fn();
      private readonly callback: IntersectionObserverCallback;
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback;
      }
      observe(target: Element) {
        this.callback(
          [{target, isIntersecting: true} as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof IntersectionObserver;
  });
  afterAll(() => {
    window.IntersectionObserver = OriginalIntersectionObserver;
  });

  // Register one section's issue mock, matched on its query bucket. `hits`
  // seeds the X-Hits header that drives the section count badge.
  function mockSection(query: string, options: {body?: unknown[]; hits?: string} = {}) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({query})],
      body: options.body ?? [],
      ...(options.hits === undefined ? {} : {headers: {'X-Hits': options.hits}}),
    });
  }

  // The batched runs request puts its group ids inside the `query` string
  // (`group:[a, b]`), never in a separate `group` param, so mocks for it are
  // matched on that exact string.
  function mockBatchedRuns(groupIds: string[], runs: unknown[]) {
    return MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      match: [
        MockApiClient.matchQuery({
          query: `type:explorer source:autofix group:[${groupIds.join(', ')}]`,
        }),
      ],
      body: runs,
    });
  }

  // The single-group fallback shape: a bare `group:<id>` (no brackets) at
  // per_page 1. Registered explicitly per id so it takes precedence over the
  // catch-all `/seer/runs/` mock in beforeEach — without it a per-card fan-out
  // would be silently served and no assertion would notice.
  function mockPerCardRuns(groupIds: string[]) {
    return groupIds.map(groupId =>
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/seer/runs/`,
        match: [
          MockApiClient.matchQuery({
            query: `type:explorer source:autofix group:${groupId}`,
            per_page: 1,
          }),
        ],
        body: [],
      })
    );
  }

  function expectBatchedRunsCall(request: jest.Mock, groupIds: string[]) {
    expect(request).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/runs/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: `type:explorer source:autofix group:[${groupIds.join(', ')}]`,
          question: RUN_QUESTION_PROMPTS,
          per_page: groupIds.length,
        }),
      })
    );
  }

  // Fills the review bucket with `count` issues, plus their (empty) autofix
  // state mocks. `hits` defaults to the returned count.
  function mockBulkIssues(count: number, hits?: string) {
    const groups = Array.from({length: count}, (_, index) =>
      GroupFixture({
        id: `${100 + index}`,
        shortId: `PROJ-${100 + index}`,
        title: `Bulk issue ${index}`,
      })
    );
    groups.forEach(group => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
        body: {autofix: null},
      });
    });
    mockSection(SECTION_QUERIES.review_pr, {body: groups, hits: hits ?? String(count)});
    return groups;
  }

  function mockAssigneeSections(assignee: string, reviewIssues: unknown[] = [issue]) {
    const reviewRequest = mockSection(
      `${SECTION_QUERIES.review_pr} assigned:${assignee}`,
      {
        body: reviewIssues,
        hits: String(reviewIssues.length),
      }
    );
    mockSection(`${SECTION_QUERIES.code_changes_ready} assigned:${assignee}`);
    mockSection(`${SECTION_QUERIES.solution_ready} assigned:${assignee}`);
    mockSection(`${SECTION_QUERIES.needs_investigation} assigned:${assignee}`);
    mockSection(`${SECTION_QUERIES.merged} assigned:${assignee}`);
    return reviewRequest;
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Collapsed status groups persist to localStorage; keep tests isolated.
    localStorage.clear();

    // The project page filter needs seeded page-filter + project stores, or
    // PageFiltersContainer never reports ready and the section queries stay
    // gated off.
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture());
    ProjectsStore.loadInitialData([ProjectFixture()]);
    OrganizationStore.onUpdate(organization, {replace: true});
    TeamStore.reset();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture()],
    });

    // One issue lives in the review bucket (X-Hits 3 exceeds the returned
    // body, proving the count comes from the header); the other four are empty.
    mockSection(SECTION_QUERIES.review_pr, {body: [issue], hits: '3'});
    mockSection(SECTION_QUERIES.code_changes_ready);
    mockSection(SECTION_QUERIES.solution_ready);
    mockSection(SECTION_QUERIES.needs_investigation);
    mockSection(SECTION_QUERIES.merged);

    // The assignee filter loads org members for its dropdown; teams come from
    // the (empty here) TeamStore. Neither is needed for the default view.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    // Per-card content: the IntersectionObserver override above reports every
    // card as in view, so these fire once per rendered card.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [makeRun()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {autofix: makeAutofixState()},
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

  it('renders the five status sections with server-provided counts', async () => {
    renderPage();

    // Every section renders, in order, with its X-Hits count in the badge.
    const reviewHeader = await screen.findByRole('button', {
      name: 'Review Open PRs 3',
    });
    expect(screen.getByRole('button', {name: 'Create PR 0'})).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Generate code changes 0'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Confirm Root Cause 0'})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Merged 0'})).toBeInTheDocument();

    // The headers render in pipeline (SECTION_ORDER) order; reordering the
    // PIPELINE table reorders these and fails here.
    const orderedHeaders = [
      /Review Open PRs/,
      /Create PR/,
      /Generate code changes/,
      /Confirm Root Cause/,
      /Merged/,
    ].map(name => screen.getByRole('button', {name}));
    for (let index = 0; index < orderedHeaders.length - 1; index++) {
      expect(
        orderedHeaders[index]!.compareDocumentPosition(orderedHeaders[index + 1]!) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }

    // The review bucket's issue renders as a card between its own header and
    // the next section — server-bucketed, not classified client-side.
    const titleLink = await screen.findByRole('link', {
      name: 'Proxy requests fail without Authorization header',
    });
    const codeHeader = screen.getByRole('button', {name: 'Create PR 0'});
    expect(
      reviewHeader.compareDocumentPosition(titleLink) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      titleLink.compareDocumentPosition(codeHeader) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Card prose is hydrated from the per-card runs fetch.
    expect(
      screen.getByText('Commit c5bb895 stopped sending the Authorization header.')
    ).toBeInTheDocument();

    // The four empty buckets each show their own empty text.
    expect(screen.getAllByText('No issues')).toHaveLength(4);

    // The legacy outcome / needs-attention filters and pagination are gone.
    expect(screen.queryByRole('button', {name: /Outcome/})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /Needs attention/})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });

  it('renders a card with real run metadata and analysis in thought order', async () => {
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

    // An opened PR reads as needing review, carries its number in the
    // label, and links out to the PR.
    expect(screen.getByRole('button', {name: 'Review PR #123'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/123'
    );

    // Exact patch stats from merged_file_patches, not an LLM estimate.
    expect(screen.getByText('1 file')).toBeInTheDocument();
    expect(screen.getByText('+42')).toBeInTheDocument();
    expect(screen.getByText('−7')).toBeInTheDocument();

    // The card never renders the diff itself; the file path lives only in
    // the pill's hover tooltip.
    expect(screen.queryByText('src/cart.py')).not.toBeInTheDocument();

    // Hovering the diff pill lists the changed files.
    await userEvent.hover(screen.getByText('1 file'));
    expect(await screen.findByText('src/cart.py')).toBeInTheDocument();

    // Issue impact numbers, abbreviated.
    expect(screen.getByText(/100 events/)).toBeInTheDocument();

    // Both analysis sections render on the card face with no expansion needed…
    const rootCause = screen.getByText('Root cause');
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

    // Issue recency and Seer activity are two distinct timestamps: the
    // issue's own lastSeen, then the newest Seer-side signal (here the
    // state's updated_at) — never lastSeen again.
    expect(
      screen.getAllByRole('time').map(element => element.getAttribute('datetime'))
    ).toEqual(['2019-04-11T01:08:59.000Z', '2026-07-14T10:00:00.000Z']);

    expect(
      screen.getByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Modify issue priority'})
    ).toBeInTheDocument();

    // Identity sits in the tail: short id + exactly one level marker.
    expect(screen.getByText('PROJ-1')).toBeVisible();
    expect(screen.getAllByText('Level: Warning')).toHaveLength(1);
  });

  it('switches between card and table views', async () => {
    renderPage();

    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Root cause')).toBeVisible();
    expect(screen.getByRole('radio', {name: 'Card view'})).toBeChecked();

    await userEvent.click(screen.getByRole('radio', {name: 'Table view'}));

    expect(screen.getByRole('radio', {name: 'Table view'})).toBeChecked();
    // The full analysis is card-only; the table row is the scannable summary.
    expect(screen.queryByText('Root cause')).not.toBeInTheDocument();
    expect(screen.getByText('PROJ-1')).toBeVisible();
    expect(screen.getByText('100 events')).toBeVisible();
    expect(screen.getByText('5 users')).toBeVisible();
    expect(screen.getByRole('button', {name: 'Review PR #123'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/123'
    );
  });

  it('leads with the root cause and a single next step when no code was drafted', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        makeRun({
          source: 'autofix',
          outputs: [makeOutput(2, 'Decide whether to relax the constraint.')],
        }),
      ],
    });

    renderPage();

    // No headline answer → the raw issue title renders.
    expect(
      await screen.findByRole('link', {name: 'TypeError in checkout cart'})
    ).toBeInTheDocument();

    // The notes read as the next step (waits for the per-card runs fetch).
    expect(await screen.findByText('Next steps')).toBeVisible();
    expect(screen.getByText('Decide whether to relax the constraint.')).toBeVisible();
    // No drafted fix → no fix section.
    expect(screen.queryByText('Proposed fix')).not.toBeInTheDocument();
  });

  it('keeps the section review action even when the run enrichment looks merged', async () => {
    // A review_pr-section card whose enrichment carries a merged PR: the
    // section is the anchor, so the card still shows Review PR rather than a
    // stale Merged tag. Merged rendering is asserted in the merged-section test.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      body: [
        makeRun({
          source: 'autofix',
          pullRequests: [{status: 'merged'}],
          outputs: [],
        }),
      ],
    });

    renderPage();

    // The review action wins, linking to the open PR from the run state.
    expect(await screen.findByRole('button', {name: 'Review PR #123'})).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/pull/123'
    );
    // Only the always-present (empty) Merged section header — no leaked card tag.
    expect(screen.getByRole('button', {name: 'Merged 0'})).toBeInTheDocument();
    expect(screen.getAllByText('Merged')).toHaveLength(1);
  });

  it('collapses sections individually and in bulk', async () => {
    renderPage();

    const reviewHeader = await screen.findByRole('button', {
      name: 'Review Open PRs 3',
    });
    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();

    // Collapsing a section hides only its cards.
    await userEvent.click(reviewHeader);
    expect(
      screen.queryByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).not.toBeInTheDocument();

    await userEvent.click(reviewHeader);
    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();

    // The bulk toggle folds everything, then flips to Expand all.
    await userEvent.click(screen.getByRole('button', {name: 'Collapse all'}));
    expect(
      screen.queryByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Expand all'}));
    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();
  });

  it('renders only the first page of a section behind a show-more button', async () => {
    mockBulkIssues(30);

    renderPage();

    await screen.findByRole('button', {name: 'Review Open PRs 30'});
    // A section never renders more than PAGE_SIZE cards up front, however many
    // issues the fetch returned.
    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(10);
    expect(screen.getByRole('link', {name: 'Bulk issue 9'})).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Bulk issue 10'})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Show 10 more'})).toBeInTheDocument();
  });

  it('reveals another page per click, batching runs for only the new ids', async () => {
    const many = mockBulkIssues(30);
    const ids = many.map(group => group.id);
    // No outputs, so each card keeps its raw issue title to assert on.
    const runsFor = (groupIds: string[]) =>
      groupIds.map(groupId => makeRun({id: `run-${groupId}`, groupId, outputs: []}));

    const firstBatch = mockBatchedRuns(ids.slice(0, 10), runsFor(ids.slice(0, 10)));
    // A dedicated mock per visible id, so any card that fetched its own run
    // would register here instead of vanishing into the catch-all. These must
    // stay at zero calls: the batch covers every visible card, and fanning out
    // one request per card is the exact cost this feature exists to avoid.
    const perCard = mockPerCardRuns(ids);

    renderPage();

    expect(await screen.findByRole('link', {name: /Bulk issue 0/})).toBeInTheDocument();
    await waitFor(() => expect(firstBatch).toHaveBeenCalledTimes(1));
    expectBatchedRunsCall(firstBatch, ids.slice(0, 10));
    perCard.forEach(request => expect(request).not.toHaveBeenCalled());

    // Only the newly revealed ids are batched; the first page's chunk is served
    // from cache rather than refetched.
    const secondBatch = mockBatchedRuns(ids.slice(10, 20), runsFor(ids.slice(10, 20)));

    await userEvent.click(screen.getByRole('button', {name: 'Show 10 more'}));

    expect(await screen.findByRole('link', {name: /Bulk issue 19/})).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(20);
    await waitFor(() => expect(secondBatch).toHaveBeenCalledTimes(1));
    expectBatchedRunsCall(secondBatch, ids.slice(10, 20));
    // One batched request per click — cards never fan out individually.
    expect(firstBatch).toHaveBeenCalledTimes(1);
    perCard.forEach(request => expect(request).not.toHaveBeenCalled());

    // Ten issues remain, so the button still offers a full page.
    expect(screen.getByRole('button', {name: 'Show 10 more'})).toBeInTheDocument();

    const thirdBatch = mockBatchedRuns(ids.slice(20, 30), runsFor(ids.slice(20, 30)));

    await userEvent.click(screen.getByRole('button', {name: 'Show 10 more'}));

    expect(await screen.findByRole('link', {name: /Bulk issue 29/})).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(30);
    await waitFor(() => expect(thirdBatch).toHaveBeenCalledTimes(1));
    expectBatchedRunsCall(thirdBatch, ids.slice(20, 30));
    // Everything is visible, so the button is gone.
    expect(screen.queryByRole('button', {name: /Show \d+ more/})).not.toBeInTheDocument();

    // Three pages of cards cost exactly three runs requests in total.
    expect(firstBatch).toHaveBeenCalledTimes(1);
    expect(secondBatch).toHaveBeenCalledTimes(1);
    perCard.forEach(request => expect(request).not.toHaveBeenCalled());
  });

  it('keeps the badge on the true hit count while paginating', async () => {
    // Pagination is purely client-side, so the badge keeps reporting what the
    // server said — not how many cards happen to be visible.
    mockBulkIssues(30, '150');

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Review Open PRs 100+'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show 10 more'}));

    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(20);
    expect(
      screen.getByRole('button', {name: 'Review Open PRs 100+'})
    ).toBeInTheDocument();
  });

  // Two issues in the review bucket, both with autofix state, for the
  // batch-miss fallback tests below.
  function mockFallbackPair() {
    const groupA = GroupFixture({id: '300', shortId: 'PROJ-300', title: 'Covered issue'});
    const groupB = GroupFixture({id: '301', shortId: 'PROJ-301', title: 'Missing issue'});
    [groupA, groupB].forEach(group => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/autofix/`,
        body: {autofix: makeAutofixState()},
      });
    });
    mockSection(SECTION_QUERIES.review_pr, {body: [groupA, groupB], hits: '2'});
    // The single-group fallback for the group the batch will omit.
    const fallback = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      match: [
        MockApiClient.matchQuery({query: 'type:explorer source:autofix group:301'}),
      ],
      body: [
        makeRun({
          id: 'run-301',
          groupId: '301',
          outputs: [makeOutput(0, 'Headline B|cause B')],
        }),
      ],
    });
    // A run for the covered group only, as if the endpoint spent 301's slot on
    // a duplicate of 300 (what happens when a group has several runs).
    const partialBatchBody = [
      makeRun({
        id: 'run-300',
        groupId: '300',
        outputs: [makeOutput(0, 'Headline A|cause A')],
      }),
    ];
    return {fallback, partialBatchBody};
  }

  it('holds every card off its own runs call while the batch is in flight', async () => {
    const {fallback, partialBatchBody} = mockFallbackPair();
    // Never settles within the test: while a batch is unsettled every group
    // looks absent, so a card that fell back here would double the requests.
    const batch = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/runs/`,
      match: [
        MockApiClient.matchQuery({
          query: 'type:explorer source:autofix group:[300, 301]',
        }),
      ],
      body: partialBatchBody,
      asyncDelay: 100_000,
    });

    renderPage();

    // Both cards are mounted, the batch is in flight, and the section has
    // rendered its issues — the point at which an ungated card would fetch.
    await waitFor(() => expect(batch).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('PROJ-301')).toBeInTheDocument();
    expect(screen.getByText('PROJ-300')).toBeInTheDocument();
    // Nothing fell back, and no narration is on screen yet, so the cards really
    // are waiting on the batch rather than having been served by anything else.
    expect(fallback).not.toHaveBeenCalled();
    expect(screen.queryByText('cause A')).not.toBeInTheDocument();
    expect(screen.queryByText('cause B')).not.toBeInTheDocument();
  });

  it('falls back to a per-card runs call once the batch settles without a group', async () => {
    const {fallback, partialBatchBody} = mockFallbackPair();
    const batch = mockBatchedRuns(['300', '301'], partialBatchBody);

    renderPage();

    // The uncovered card still hydrates, from its own single-group request.
    expect(await screen.findByText('cause B')).toBeInTheDocument();
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/seer/runs/`,
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'type:explorer source:autofix group:301',
          question: RUN_QUESTION_PROMPTS,
          per_page: 1,
        }),
      })
    );
    // The batch fires before the fallback it triggers: the fallback is a
    // reaction to a settled miss, not a parallel request from mount.
    expect(batch.mock.invocationCallOrder[0]).toBeLessThan(
      fallback.mock.invocationCallOrder[0]!
    );
    // The covered card is served by the batch alone — it never falls back.
    expect(await screen.findByText('cause A')).toBeInTheDocument();
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('resets a grown section when the filters change but not when it collapses', async () => {
    mockBulkIssues(30);

    const {router} = renderPage();

    await screen.findByRole('button', {name: 'Review Open PRs 30'});
    await userEvent.click(screen.getByRole('button', {name: 'Show 10 more'}));
    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(20);

    // Collapsing unmounts the section body, but the page counts live in
    // SectionList, so reopening restores the grown page.
    const reviewHeader = screen.getByRole('button', {name: 'Review Open PRs 30'});
    await userEvent.click(reviewHeader);
    expect(screen.queryByRole('link', {name: /Bulk issue/})).not.toBeInTheDocument();
    await userEvent.click(reviewHeader);
    expect(await screen.findByRole('link', {name: /Bulk issue 19/})).toBeInTheDocument();
    expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(20);

    // A new period is a new issues query, so the pages start over.
    router.navigate(`${basePath}?period=24h`);

    await waitFor(() =>
      expect(screen.getAllByRole('link', {name: /Bulk issue/})).toHaveLength(10)
    );
    expect(screen.getByRole('button', {name: 'Show 10 more'})).toBeInTheDocument();
  });

  it('caps the section count badge at 100+ when hits exceed the fetch limit', async () => {
    // Only 100 issues are ever fetched per section, so an exact total above
    // that would overstate what scrolling can reveal.
    mockSection(SECTION_QUERIES.code_changes_ready, {body: [issue], hits: '150'});

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Create PR 100+'})
    ).toBeInTheDocument();
  });

  it('surfaces the blocking question when a run awaits user input', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: makeAutofixState({
          status: 'awaiting_user_input',
          blocks: [makeBlock('root_cause')],
          // Canonical ask_user_question shape: the text is nested under
          // questions[0].question, not a flat key.
          pending_user_input: {
            input_type: 'ask_user_question',
            data: {
              questions: [{question: 'Which environment should I target?', options: []}],
            },
          },
        }),
      },
    });

    renderPage();

    expect(
      await screen.findByText('Seer asked: Which environment should I target?')
    ).toBeInTheDocument();
  });

  it('scopes section and member requests to the selected project', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [2]}));
    const reviewRequest = mockSection(SECTION_QUERIES.review_pr, {
      body: [issue],
      hits: '3',
    });
    const membersRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Modify issue assignee'})
    ).toBeInTheDocument();
    expect(reviewRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/`,
      expect.objectContaining({
        query: expect.objectContaining({project: [2]}),
      })
    );
    expect(membersRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/users/`,
      expect.objectContaining({
        query: expect.objectContaining({project: ['2']}),
      })
    );
    expect(membersRequest).toHaveBeenCalledTimes(1);
  });

  it('focuses a single card when id is present', async () => {
    // The focus fetch pins the exact group id (and the endpoint ignores the
    // section filters in that mode).
    const groupRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [issue],
      match: [MockApiClient.matchQuery({group: ['2']})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/2/autofix/`,
      body: {
        autofix: makeAutofixState({
          blocks: [
            makeBlock('code_changes', {
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
            }),
          ],
        }),
      },
    });

    renderPage({id: '2'});

    // The full analysis renders without any interaction.
    expect(await screen.findByText('Root cause')).toBeVisible();
    expect(screen.getByText('PROJ-1')).toBeVisible();
    expect(groupRequest).toHaveBeenCalled();

    // Focus mode hides the section list and offers the way back, keeping the
    // other params.
    expect(
      screen.queryByRole('button', {name: /Review Open PRs/})
    ).not.toBeInTheDocument();
    const backLink = screen.getByRole('button', {name: 'All issues'});
    expect(backLink).toHaveAttribute('href', expect.not.stringContaining('id=2'));
  });

  it('shows the empty state when every section resolves empty', async () => {
    // Two projects so page filters default to "My Projects" (empty selection)
    // rather than force-selecting the only project; the default period then
    // makes this the no-filter case.
    ProjectsStore.loadInitialData([
      ProjectFixture(),
      ProjectFixture({id: '11', slug: 'project-two'}),
    ]);
    mockSection(SECTION_QUERIES.review_pr, {body: []});

    renderPage();

    expect(await screen.findByText('No completed autofix runs yet.')).toBeInTheDocument();
    // The section list is replaced entirely by the empty state.
    expect(
      screen.queryByRole('button', {name: /Review Open PRs/})
    ).not.toBeInTheDocument();
  });

  it('shows a filter-aware empty message when a non-default period is active', async () => {
    // Two projects keep the selection empty, so the non-default period is the
    // only active filter.
    ProjectsStore.loadInitialData([
      ProjectFixture(),
      ProjectFixture({id: '11', slug: 'project-two'}),
    ]);
    mockSection(SECTION_QUERIES.review_pr, {body: []});

    renderPage({period: '24h'});

    expect(
      await screen.findByText('No autofix runs match your filters.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No completed autofix runs yet.')).not.toBeInTheDocument();
  });

  it('surfaces per-section errors instead of the global empty state', async () => {
    mockSection(SECTION_QUERIES.review_pr, {body: []});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({query: SECTION_QUERIES.code_changes_ready})],
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage();

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
    expect(screen.queryByText('No completed autofix runs yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Review Open PRs/})).toBeInTheDocument();
  });

  it('surfaces a per-section error while other sections still load', async () => {
    // Only the code-changes bucket fails; the others resolve as seeded.
    const codeIssue = GroupFixture({
      id: '3',
      shortId: 'PROJ-3',
      title: 'Retry succeeded issue',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/3/autofix/`,
      body: {autofix: null},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({query: SECTION_QUERIES.code_changes_ready})],
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage();

    // The review bucket still renders its card…
    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();
    // …while the failed section shows a retryable error inline.
    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();

    // Re-arm the section with a success response, then retry: its card
    // appears, proving the LoadingError's onRetry refetches the section.
    mockSection(SECTION_QUERIES.code_changes_ready, {body: [codeIssue], hits: '1'});
    await userEvent.click(screen.getByRole('button', {name: 'Retry'}));

    expect(
      await screen.findByRole('link', {name: 'Retry succeeded issue'})
    ).toBeInTheDocument();
  });

  it('renders an error state only when every section fails', async () => {
    // An unmatched mock is newest, so it answers all five section requests.
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

  it('falls back to the body length for the count when X-Hits is absent', async () => {
    // No X-Hits header, so the badge reports the returned body length.
    mockSection(SECTION_QUERIES.review_pr, {body: [issue]});

    renderPage();

    expect(
      await screen.findByRole('button', {name: 'Review Open PRs 1'})
    ).toBeInTheDocument();
  });

  it('shows a not-found message when the focused issue resolves empty', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({group: ['2']})],
      body: [],
    });

    renderPage({id: '2'});

    expect(await screen.findByText('Issue not found.')).toBeInTheDocument();
  });

  it('shows an error state when the focused issue request fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({group: ['2']})],
      statusCode: 500,
      body: {detail: 'boom'},
    });

    renderPage({id: '2'});

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('selects a remote member, writes it to the URL, and filters sections', async () => {
    const remoteUser = UserFixture({
      id: '42',
      name: 'Remote Member',
      email: 'remote.member@example.com',
      username: 'Jane Doe',
    });
    const remoteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      match: [MockApiClient.matchQuery({query: remoteUser.username})],
      body: [MemberFixture({id: '42', user: remoteUser})],
    });
    const reviewRequest = mockAssigneeSections('"Jane Doe"');
    const {router} = renderPage();

    await userEvent.click(await screen.findByRole('button', {name: 'Assignee None'}));
    await userEvent.type(
      screen.getByPlaceholderText('Search assignees…'),
      remoteUser.username
    );
    await userEvent.click(await screen.findByRole('option', {name: remoteUser.name}));

    expect(remoteRequest).toHaveBeenCalled();
    expect(router.location.query.assignee).toBe(remoteUser.username);
    await waitFor(() =>
      expect(reviewRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/issues/`,
        expect.objectContaining({
          query: expect.objectContaining({
            query: `${SECTION_QUERIES.review_pr} assigned:"Jane Doe"`,
          }),
        })
      )
    );
  });

  it('finds remote teams by slug and writes the selected team to the URL', async () => {
    const remoteTeam = TeamFixture({
      id: '42',
      name: 'Remote Team',
      slug: 'remote-team',
    });
    const remoteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      match: [MockApiClient.matchQuery({query: 'remote-team'})],
      body: [remoteTeam],
    });
    mockAssigneeSections(`#${remoteTeam.slug}`);
    const {router} = renderPage();

    await userEvent.click(await screen.findByRole('button', {name: 'Assignee None'}));
    await userEvent.type(
      screen.getByPlaceholderText('Search assignees…'),
      `#${remoteTeam.slug}`
    );
    await userEvent.click(
      await screen.findByRole('option', {name: `#${remoteTeam.slug}`})
    );

    expect(remoteRequest).toHaveBeenCalled();
    expect(router.location.query.assignee).toBe(`#${remoteTeam.slug}`);
  });

  it('refetches filtered sections after reassignment', async () => {
    const nextAssignee = UserFixture({
      id: '42',
      name: 'Next Assignee',
      email: 'next.assignee@example.com',
    });
    mockAssigneeSections('me');
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [
        MemberFixture({
          id: '42',
          projects: [issue.project.slug],
          user: nextAssignee,
        }),
      ],
    });
    const assignRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${issue.id}/`,
      method: 'PUT',
      body: {
        ...issue,
        assignedTo: {id: nextAssignee.id, name: nextAssignee.name, type: 'user'},
      },
    });

    renderPage({assignee: 'me'});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Modify issue assignee'})
    );

    // The mutation's success callback immediately refetches all sections, so
    // replace their responses before selecting the new assignee.
    mockAssigneeSections('me', []);
    await userEvent.click(await screen.findByRole('option', {name: /Next Assignee/}));

    await waitFor(() => expect(assignRequest).toHaveBeenCalled());
    expect(
      await screen.findByText('No autofix runs match your filters.')
    ).toBeInTheDocument();
  });

  it('refetches unfiltered sections after reassignment', async () => {
    const nextAssignee = UserFixture({
      id: '42',
      name: 'Next Assignee',
      email: 'next.assignee@example.com',
    });
    const reviewRequest = mockSection(SECTION_QUERIES.review_pr, {
      body: [issue],
      hits: '3',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [
        MemberFixture({
          id: '42',
          projects: [issue.project.slug],
          user: nextAssignee,
        }),
      ],
    });
    const assignRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${issue.id}/`,
      method: 'PUT',
      body: {
        ...issue,
        assignedTo: {id: nextAssignee.id, name: nextAssignee.name, type: 'user'},
      },
    });

    renderPage();

    await waitFor(() => expect(reviewRequest).toHaveBeenCalledTimes(1));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Modify issue assignee'})
    );
    await userEvent.click(await screen.findByRole('option', {name: /Next Assignee/}));

    await waitFor(() => expect(assignRequest).toHaveBeenCalled());
    await waitFor(() => expect(reviewRequest).toHaveBeenCalledTimes(2));
  });

  it('invalidates cached filtered sections after reassignment in focus mode', async () => {
    const nextAssignee = UserFixture({
      id: '42',
      name: 'Next Assignee',
      email: 'next.assignee@example.com',
    });
    mockAssigneeSections('me');
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({group: [issue.id]})],
      body: [issue],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [
        MemberFixture({
          id: nextAssignee.id,
          projects: [issue.project.slug],
          user: nextAssignee,
        }),
      ],
    });
    const assignRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${issue.id}/`,
      method: 'PUT',
      body: {
        ...issue,
        assignedTo: {id: nextAssignee.id, name: nextAssignee.name, type: 'user'},
      },
    });
    const {router} = renderPage({assignee: 'me'});

    expect(
      await screen.findByRole('link', {
        name: 'Proxy requests fail without Authorization header',
      })
    ).toBeInTheDocument();
    router.navigate(`${basePath}?assignee=me&id=${issue.id}`);
    expect(await screen.findByRole('button', {name: 'All issues'})).toBeInTheDocument();

    mockAssigneeSections('me', []);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      match: [MockApiClient.matchQuery({group: [issue.id]})],
      body: [
        {
          ...issue,
          assignedTo: {id: nextAssignee.id, name: nextAssignee.name, type: 'user'},
        },
      ],
    });
    await userEvent.click(
      await screen.findByRole('button', {name: 'Modify issue assignee'})
    );
    await userEvent.click(await screen.findByRole('option', {name: /Next Assignee/}));
    await waitFor(() => expect(assignRequest).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', {name: 'All issues'}));

    expect(
      await screen.findByText('No autofix runs match your filters.')
    ).toBeInTheDocument();
  });
});
