import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TestsOnboardingPage from 'sentry/views/prevent/tests/onboarding';

describe('TestsOnboardingPage', () => {
  it('renders with GitHub Actions selected by default if no query param is provided', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/prevent/tests/new',
          query: {},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with GitHub Actions selected by default if empty opt query param is provided', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/prevent/tests/new',
          query: {opt: ''},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with CLI selected when opt=cli in URL', () => {
    render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/prevent/tests/new',
          query: {opt: 'cli'},
        },
      },
    });

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).toBeChecked();

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();
  });

  it('updates URL when GitHub Actions option is selected', async () => {
    const {router} = render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/prevent/tests/new',
          query: {opt: 'cli'},
        },
      },
    });

    const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();

    await userEvent.click(githubRadio);

    expect(router.location.search).toBe('?opt=githubAction');
  });

  it('updates URL when CLI option is selected', async () => {
    const {router} = render(<TestsOnboardingPage />, {
      initialRouterConfig: {
        location: {
          pathname: '/prevent/tests/new',
          query: {opt: ''},
        },
      },
    });

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();

    await userEvent.click(cliRadio);

    expect(router.location.search).toBe('?opt=cli');
  });

  describe('Step rendering based on SetupOption', () => {
    describe('GitHub Actions setup option', () => {
      it('renders correct steps for GitHub Actions with OIDC upload permission by default', () => {
        render(<TestsOnboardingPage />, {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'githubAction'},
            },
          },
        });

        expect(
          screen.getByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 2: Choose an upload permission')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Use OpenID Connect (OIDC)')).toBeChecked();
        expect(
          screen.getByLabelText('Use Sentry Prevent Upload Token')
        ).not.toBeChecked();
        expect(
          screen.getByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 4: Run your test suite')).toBeInTheDocument();
        expect(screen.getByText('Step 5: View results and insights')).toBeInTheDocument();

        // CLI-specific steps should NOT be present
        expect(screen.queryByText('Step 2: Add token as')).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 3: Install Sentry Prevent CLI')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 4: Upload this file to Sentry Prevent using the CLI')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 6: View results and insights')
        ).not.toBeInTheDocument();
      });

      it('renders correct steps for GitHub Actions with Upload Token permission when selected', async () => {
        render(<TestsOnboardingPage />, {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'githubAction'},
            },
          },
        });

        // Change upload permission to Upload Token
        const uploadTokenRadio = screen.getByLabelText('Use Sentry Prevent Upload Token');
        await userEvent.click(uploadTokenRadio);
        expect(
          screen.getByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 2: Choose an upload permission')
        ).toBeInTheDocument();
        expect(screen.getByLabelText('Use Sentry Prevent Upload Token')).toBeChecked();
        expect(screen.getByLabelText('Use OpenID Connect (OIDC)')).not.toBeChecked();
        expect(screen.getByText('Step 2b: Add token as')).toBeInTheDocument();
        expect(screen.getByText(/^Step 3: Add the script/)).toBeInTheDocument();
        expect(screen.getByText('Step 4: Run your test suite')).toBeInTheDocument();
        expect(screen.getByText('Step 5: View results and insights')).toBeInTheDocument();

        // OIDC-specific steps should NOT be present
        expect(
          screen.queryByText('Step 3: Edit your GitHub Actions workflow')
        ).not.toBeInTheDocument();

        // CLI-specific steps should NOT be present
        expect(screen.getByText('Step 2b: Add token as')).toBeInTheDocument(); // This is the upload token step, not CLI step
        expect(
          screen.queryByText('Step 3: Install Sentry Prevent CLI')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 4: Upload this file to Sentry Prevent using the CLI')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 6: View results and insights')
        ).not.toBeInTheDocument();
      });

      it('switches between OIDC and Upload Token steps when permission changes', async () => {
        render(<TestsOnboardingPage />, {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'githubAction'},
            },
          },
        });

        // Initially should show OIDC steps
        expect(
          screen.getByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.queryByText('Step 2b: Add token as')).not.toBeInTheDocument();
        expect(screen.queryByText(/Step 3: Add the script/)).not.toBeInTheDocument();

        // Switch to Upload Token
        const uploadTokenRadio = screen.getByLabelText('Use Sentry Prevent Upload Token');
        await userEvent.click(uploadTokenRadio);

        // Should now show Upload Token steps
        expect(
          screen.queryByText('Step 3: Edit your GitHub Actions workflow')
        ).not.toBeInTheDocument();
        expect(screen.getByText('Step 2b: Add token as')).toBeInTheDocument();
        expect(screen.getByText(/Step 3: Add the script/)).toBeInTheDocument();

        // Switch back to OIDC
        const oidcRadio = screen.getByLabelText('Use OpenID Connect (OIDC)');
        await userEvent.click(oidcRadio);

        // Should show OIDC steps again
        expect(
          screen.getByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.queryByText('Step 2b: Add token as')).not.toBeInTheDocument();
        expect(screen.queryByText(/Step 3: Add the script/)).not.toBeInTheDocument();
      });
    });

    describe('CLI setup option', () => {
      it('renders correct steps for CLI setup option', () => {
        render(<TestsOnboardingPage />, {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'cli'},
            },
          },
        });
        expect(
          screen.getByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 2: Add token as')).toBeInTheDocument();
        expect(
          screen.getByRole('link', {name: 'Sentry Prevent CLI'})
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 3: Install the', {exact: false})
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 4: Upload this file to Sentry Prevent using the CLI')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 5: Run your test suite')).toBeInTheDocument();
        expect(screen.getByText('Step 6: View results and insights')).toBeInTheDocument();

        // GitHub Actions specific steps should NOT be present
        expect(
          screen.queryByText('Step 2: Choose an upload permission')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 3: Edit your GitHub Actions workflow')
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Step 2b: Add token as')).not.toBeInTheDocument();
        expect(screen.queryByText(/Step 3: Add the script/)).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 5: View results and insights')
        ).not.toBeInTheDocument(); // This is step 6 in CLI
      });

      it('CLI setup option is not affected by upload permission changes', async () => {
        render(<TestsOnboardingPage />, {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'cli'},
            },
          },
        });

        // Should show CLI steps regardless of upload permission
        expect(
          screen.getByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 2: Add token as')).toBeInTheDocument();
        expect(
          screen.getByRole('link', {name: 'Sentry Prevent CLI'})
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 3: Install the', {exact: false})
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 4: Upload this file to Sentry Prevent using the CLI')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 5: Run your test suite')).toBeInTheDocument();
        expect(screen.getByText('Step 6: View results and insights')).toBeInTheDocument();

        // Switch to GitHub Actions
        const githubRadio = screen.getByLabelText('Use GitHub Actions to run my CI');
        await userEvent.click(githubRadio);

        // Should now show GitHub Actions steps
        expect(
          screen.getByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 2: Choose an upload permission')
        ).toBeInTheDocument();
        expect(
          screen.getByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.getByText('Step 4: Run your test suite')).toBeInTheDocument();
        expect(screen.getByText('Step 5: View results and insights')).toBeInTheDocument();

        // CLI specific steps should NOT be present
        expect(screen.queryByText('Step 2: Add token as')).not.toBeInTheDocument();
        expect(
          screen.queryByRole('link', {name: 'Sentry Prevent CLI'})
        ).not.toBeInTheDocument();
        expect(screen.queryByText('Step 3: Install the')).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 4: Upload this file to Sentry Prevent using the CLI')
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText('Step 6: View results and insights')
        ).not.toBeInTheDocument();
      });
    });
  });
});
