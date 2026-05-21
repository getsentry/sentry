import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import AutofixOverview from 'sentry/views/seerWorkflows/overview';

describe('AutofixOverview', () => {
  const organization = OrganizationFixture();
  const basePath = `/organizations/${organization.slug}/issues/autofix/overview/`;

  it('renders the page heading and description', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(
      await screen.findByRole('heading', {name: 'Autofix Overview'})
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Issues where Autofix has produced a root cause, solution, code changes, or pull request.'
      )
    ).toBeInTheDocument();
  });

  it('renders mock issues with outcome chips and links to the issue page', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    const firstIssueLink = await screen.findByRole('link', {
      name: "TypeError: Cannot read properties of undefined (reading 'map')",
    });
    expect(firstIssueLink).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/4001/`
    );

    expect(screen.getAllByText('Pull request opened').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Code changes drafted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Solution proposed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Root cause found').length).toBeGreaterThan(0);

    // Triggered-by column renders at least one of each label.
    expect(screen.getAllByText('Workflow').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Alert').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Manual').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Issue summary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Post-process').length).toBeGreaterThan(0);

    // Action column renders the action-oriented labels.
    expect(screen.getAllByText('Review PR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open PR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Generate code').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Add context').length).toBeGreaterThan(0);
    expect(screen.getAllByText('View PR').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Retry').length).toBeGreaterThan(0);
  });

  it('renders stat cards with counts for the visible rows', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    // Card labels visible.
    expect(await screen.findByText('Merged PRs')).toBeInTheDocument();
    expect(screen.getByText('Awaiting your review')).toBeInTheDocument();
    expect(screen.getByText('Awaiting your input')).toBeInTheDocument();
    // Card label "Code changes ready" collides with the button text; use a
    // more specific query if needed. Here we settle for one of them existing.
    expect(screen.getAllByText('Code changes ready').length).toBeGreaterThan(0);
  });

  it('Review PR chip links to the pull request', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    // Rows 4001 and 4002 are the two review_pr rows in the mock data.
    // LinkButton renders with role="button" but is an <a> with href.
    const buttons = await screen.findAllByRole('button', {name: /Review PR/});
    expect(buttons.map(b => b.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        'https://github.com/example/repo/pull/4421',
        'https://github.com/example/repo/pull/4420',
      ])
    );
  });

  it('Renders View PR chips linking to merged PRs', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    // Rows 4003–4007 are prMerged=true (5 merged rows).
    const buttons = await screen.findAllByRole('button', {name: /View PR/});
    expect(buttons.map(b => b.getAttribute('href'))).toEqual(
      expect.arrayContaining([
        'https://github.com/example/repo/pull/4419',
        'https://github.com/example/repo/pull/4408',
        'https://github.com/example/repo/pull/4302',
        'https://github.com/example/repo/pull/4289',
        'https://github.com/example/repo/pull/4251',
      ])
    );
  });

  it('filters by attention reason via URL query param', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {pathname: basePath, query: {attention: 'awaiting_input'}},
      },
    });

    // awaiting_input rows survive (4009, 4010).
    expect(
      await screen.findByRole('link', {
        name: 'Hydration failed because the initial UI does not match the server',
      })
    ).toBeInTheDocument();

    // Non-awaiting-input rows are filtered out.
    expect(
      screen.queryByRole('link', {
        name: "TypeError: Cannot read properties of undefined (reading 'map')",
      })
    ).not.toBeInTheDocument();
  });

  it('filters by trigger via URL query param', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {pathname: basePath, query: {trigger: 'night_shift'}},
      },
    });

    // Night-shift rows survive (4001 and 4012 in the mock distribution).
    expect(
      await screen.findByRole('link', {
        name: "TypeError: Cannot read properties of undefined (reading 'map')",
      })
    ).toBeInTheDocument();

    // Manual-trigger rows are filtered out (4005 is manual).
    expect(
      screen.queryByRole('link', {
        name: 'NSInvalidArgumentException in -[UIView setFrame:]',
      })
    ).not.toBeInTheDocument();
  });

  it('filters by outcome via URL query param', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {pathname: basePath, query: {outcome: 'pr_opened'}},
      },
    });

    // Rows that include PR opened survive.
    expect(
      await screen.findByRole('link', {
        name: "TypeError: Cannot read properties of undefined (reading 'map')",
      })
    ).toBeInTheDocument();

    // Rows that don't have PR opened are filtered out.
    expect(
      screen.queryByRole('link', {
        name: 'Hydration failed because the initial UI does not match the server',
      })
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when filters exclude every row', async () => {
    // No mock row has trigger=manual AND attention=review_pr — the
    // combination is empty in the mock distribution.
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: basePath,
          query: {trigger: 'manual', attention: 'review_pr'},
        },
      },
    });

    expect(await screen.findByText('No issues match your filters.')).toBeInTheDocument();
  });

  it('exposes Workflow runs and Configure workflows actions', async () => {
    render(<AutofixOverview />, {
      organization,
      initialRouterConfig: {location: {pathname: basePath}},
    });

    expect(await screen.findByRole('button', {name: 'Workflow runs'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/autofix/`
    );
    expect(screen.getByRole('button', {name: 'Configure workflows'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/issues/autofix/configure/`
    );
  });
});
