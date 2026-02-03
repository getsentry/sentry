import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';
import {getRegionDataFromOrganization} from 'sentry/utils/regions';
import TestsOnboardingPage from 'sentry/views/prevent/tests/onboarding';

jest.mock('sentry/utils/regions', () => ({
  getRegionDataFromOrganization: jest.fn(),
}));

const mockGetRegionData = jest.mocked(getRegionDataFromOrganization);
const mockProvider = GitHubIntegrationProviderFixture();

const mockPreventContext = {
  repository: 'test-repo',
  changeContextValue: jest.fn(),
  preventPeriod: '7d',
  branch: 'main',
  integratedOrgId: '123',
  lastVisitedOrgId: '123',
};

const mockGitHubIntegration = {
  id: '123',
  name: 'github-org-name',
  domainName: 'github.com/github-org-name',
  provider: {
    key: 'github',
    name: 'GitHub',
  },
  externalId: '88888888',
  status: 'active',
};

const mockRepositories = [
  {
    name: 'test-repo-one',
    updatedAt: '2025-05-22T16:21:18.763951+00:00',
    latestCommitAt: '2025-05-21T16:21:18.763951+00:00',
    defaultBranch: 'branch-one',
  },
  {
    name: 'test-repo-two',
    updatedAt: '2025-05-22T16:21:18.763951+00:00',
    latestCommitAt: '2025-05-21T16:21:18.763951+00:00',
    defaultBranch: 'branch-two',
  },
];

const mockRepoData = {
  testAnalyticsEnabled: false,
  uploadToken: 'test-token',
};

describe('TestsOnboardingPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRegionData.mockReturnValue({
      name: 'us',
      displayName: 'United States',
      url: 'https://sentry.io',
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/',
      body: [mockGitHubIntegration],
      method: 'GET',
      match: [MockApiClient.matchQuery({provider_key: 'github', includeConfig: 0})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prevent/owner/123/repositories/',
      method: 'GET',
      body: {
        results: mockRepositories,
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prevent/owner/123/repositories/sync/',
      method: 'GET',
      body: {
        isSyncing: false,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
      body: mockRepoData,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/config/integrations/`,
      method: 'GET',
      body: {
        providers: [mockProvider],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders with GitHub Actions selected by default if no query param is provided', async () => {
    render(
      <PreventContext.Provider value={mockPreventContext}>
        <TestsOnboardingPage />
      </PreventContext.Provider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests/new',
            query: {},
          },
        },
      }
    );

    const githubRadio = await screen.findByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = screen.getByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with GitHub Actions selected by default if empty opt query param is provided', async () => {
    render(
      <PreventContext.Provider value={mockPreventContext}>
        <TestsOnboardingPage />
      </PreventContext.Provider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests/new',
            query: {opt: ''},
          },
        },
      }
    );

    const githubRadio = await screen.findByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).toBeChecked();

    const cliRadio = await screen.findByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();
  });

  it('renders with CLI selected when opt=cli in URL', async () => {
    render(
      <PreventContext.Provider value={mockPreventContext}>
        <TestsOnboardingPage />
      </PreventContext.Provider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests/new',
            query: {opt: 'cli'},
          },
        },
      }
    );

    const cliRadio = await screen.findByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).toBeChecked();

    const githubRadio = await screen.findByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();
  });

  it('updates URL when GitHub Actions option is selected', async () => {
    const {router} = render(
      <PreventContext.Provider value={mockPreventContext}>
        <TestsOnboardingPage />
      </PreventContext.Provider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests/new',
            query: {opt: 'cli'},
          },
        },
      }
    );

    const githubRadio = await screen.findByLabelText('Use GitHub Actions to run my CI');
    expect(githubRadio).not.toBeChecked();

    await userEvent.click(githubRadio);

    expect(router.location.search).toBe('?opt=githubAction');
  });

  it('updates URL when CLI option is selected', async () => {
    const {router} = render(
      <PreventContext.Provider value={mockPreventContext}>
        <TestsOnboardingPage />
      </PreventContext.Provider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tests/new',
            query: {opt: ''},
          },
        },
      }
    );

    const cliRadio = await screen.findByLabelText(
      "Use Sentry Prevent's CLI to upload testing reports"
    );
    expect(cliRadio).not.toBeChecked();

    await userEvent.click(cliRadio);

    expect(router.location.search).toBe('?opt=cli');
  });

  describe('Step rendering based on SetupOption', () => {
    describe('GitHub Actions setup option', () => {
      it('renders correct steps for GitHub Actions with OIDC upload permission by default', async () => {
        render(
          <PreventContext.Provider value={mockPreventContext}>
            <TestsOnboardingPage />
          </PreventContext.Provider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tests/new',
                query: {opt: 'githubAction'},
              },
            },
          }
        );

        expect(
          await screen.findByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 2: Choose an upload permission')
        ).toBeInTheDocument();
        expect(await screen.findByLabelText('Use OpenID Connect (OIDC)')).toBeChecked();
        expect(
          await screen.findByLabelText('Use Sentry Prevent Upload Token')
        ).not.toBeChecked();
        expect(
          await screen.findByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 4: Run your test suite')
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 5: View results and insights')
        ).toBeInTheDocument();

        // CLI-specific steps should NOT be present
        await waitFor(() => {
          const cliSteps = [
            'Step 2: Add token as',
            'Step 3: Install Sentry Prevent CLI',
            'Step 4: Upload this file to Sentry Prevent using the CLI',
            'Step 6: View results and insights',
          ];

          const hasNoCliSteps = cliSteps.every(step => !screen.queryByText(step));
          expect(hasNoCliSteps).toBe(true);
        });
      });

      it('renders correct steps for GitHub Actions with Upload Token permission when selected', async () => {
        render(
          <PreventContext.Provider value={mockPreventContext}>
            <TestsOnboardingPage />
          </PreventContext.Provider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tests/new',
                query: {opt: 'githubAction'},
              },
            },
          }
        );

        // Change upload permission to Upload Token
        const uploadTokenRadio = await screen.findByLabelText(
          'Use Sentry Prevent Upload Token'
        );
        await userEvent.click(uploadTokenRadio);
        expect(
          await screen.findByText('Step 1: Output a JUnit XML file in your CI')
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 2: Choose an upload permission')
        ).toBeInTheDocument();
        expect(
          await screen.findByLabelText('Use Sentry Prevent Upload Token')
        ).toBeChecked();
        expect(
          await screen.findByLabelText('Use OpenID Connect (OIDC)')
        ).not.toBeChecked();
        expect(await screen.findByText('Step 2b: Add token as')).toBeInTheDocument();
        expect(
          await screen.findByText(/^Step 3: Add the workflow action/)
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 4: Run your test suite')
        ).toBeInTheDocument();
        expect(
          await screen.findByText('Step 5: View results and insights')
        ).toBeInTheDocument();

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
        render(
          <PreventContext.Provider value={mockPreventContext}>
            <TestsOnboardingPage />
          </PreventContext.Provider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tests/new',
                query: {opt: 'githubAction'},
              },
            },
          }
        );

        // Initially should show OIDC steps
        expect(
          await screen.findByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.queryByText('Step 2b: Add token as')).not.toBeInTheDocument();
        expect(screen.queryByText(/Step 3: Add the script/)).not.toBeInTheDocument();

        // Switch to Upload Token
        const uploadTokenRadio = await screen.findByLabelText(
          'Use Sentry Prevent Upload Token'
        );
        await userEvent.click(uploadTokenRadio);

        // Should now show Upload Token steps
        expect(
          screen.queryByText('Step 3: Edit your GitHub Actions workflow')
        ).not.toBeInTheDocument();
        expect(await screen.findByText('Step 2b: Add token as')).toBeInTheDocument();
        expect(
          await screen.findByText(/Step 3: Add the workflow action/)
        ).toBeInTheDocument();

        // Switch back to OIDC
        const oidcRadio = await screen.findByLabelText('Use OpenID Connect (OIDC)');
        await userEvent.click(oidcRadio);

        // Should show OIDC steps again
        expect(
          await screen.findByText('Step 3: Edit your GitHub Actions workflow')
        ).toBeInTheDocument();
        expect(screen.queryByText('Step 2b: Add token as')).not.toBeInTheDocument();
        expect(screen.queryByText(/Step 3: Add the script/)).not.toBeInTheDocument();
      });
    });

    describe('CLI setup option', () => {
      it('renders correct steps for CLI setup option', async () => {
        render(
          <PreventContext.Provider value={mockPreventContext}>
            <TestsOnboardingPage />
          </PreventContext.Provider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tests/new',
                query: {opt: 'cli'},
              },
            },
          }
        );
        await Promise.all([
          waitFor(() =>
            expect(
              screen.getByText('Step 1: Output a JUnit XML file in your CI')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 2: Add token as', {exact: false})
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getAllByRole('link', {name: 'Sentry Prevent CLI'})
            ).toHaveLength(2)
          ),

          waitFor(() =>
            expect(
              screen.getByText('Step 3: Install the', {exact: false})
            ).toBeInTheDocument()
          ),

          waitFor(() =>
            expect(
              screen.getByText('Step 4: Upload this file to Sentry Prevent using the CLI')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(screen.getByText('Step 5: Run your test suite')).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 6: View results and insights')
            ).toBeInTheDocument()
          ),
        ]);

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
        ).not.toBeInTheDocument();
      });

      it('CLI setup option is not affected by upload permission changes', async () => {
        render(
          <PreventContext.Provider value={mockPreventContext}>
            <TestsOnboardingPage />
          </PreventContext.Provider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tests/new',
                query: {opt: 'cli'},
              },
            },
          }
        );

        // Should show CLI steps regardless of upload permission
        await Promise.all([
          waitFor(() =>
            expect(
              screen.getByText('Step 1: Output a JUnit XML file in your CI')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 2: Add token as', {exact: false})
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getAllByRole('link', {name: 'Sentry Prevent CLI'})
            ).toHaveLength(2)
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 3: Install the', {exact: false})
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 4: Upload this file to Sentry Prevent using the CLI')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(screen.getByText('Step 5: Run your test suite')).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 6: View results and insights')
            ).toBeInTheDocument()
          ),
        ]);

        // Switch to GitHub Actions
        const githubRadio = await screen.findByLabelText(
          'Use GitHub Actions to run my CI'
        );
        await userEvent.click(githubRadio);

        // Should now show GitHub Actions steps
        await Promise.all([
          waitFor(() =>
            expect(
              screen.getByText('Step 1: Output a JUnit XML file in your CI')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 2: Choose an upload permission')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 3: Edit your GitHub Actions workflow')
            ).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(screen.getByText('Step 4: Run your test suite')).toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.getByText('Step 5: View results and insights')
            ).toBeInTheDocument()
          ),

          // CLI specific steps should NOT be present
          waitFor(() =>
            expect(screen.queryByText('Step 2: Add token as')).not.toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.queryByRole('link', {name: 'Sentry Prevent CLI'})
            ).not.toBeInTheDocument()
          ),
          waitFor(() =>
            expect(screen.queryByText('Step 3: Install the')).not.toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.queryByText(
                'Step 4: Upload this file to Sentry Prevent using the CLI'
              )
            ).not.toBeInTheDocument()
          ),
          waitFor(() =>
            expect(
              screen.queryByText('Step 6: View results and insights')
            ).not.toBeInTheDocument()
          ),
        ]);
      });
    });
  });

  describe('Token Generation', () => {
    it('generates repository token and shows token after clicking generate button', async () => {
      // Mock repo data without token initially
      const mockRepoDataWithoutToken = {
        testAnalyticsEnabled: false,
        uploadToken: null,
      };

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
        body: mockRepoDataWithoutToken,
      });

      // Mock the regenerate token API call
      const regenerateTokenMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prevent/owner/123/repository/test-repo/token/regenerate/',
        method: 'POST',
        body: {
          token: 'new-generated-token-12345',
        },
      });

      render(
        <PreventContext.Provider value={mockPreventContext}>
          <TestsOnboardingPage />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'githubAction'},
            },
          },
        }
      );

      // Change upload permission to Upload Token to show the AddUploadTokenStep
      const uploadTokenRadio = await screen.findByLabelText(
        'Use Sentry Prevent Upload Token'
      );
      await userEvent.click(uploadTokenRadio);

      await screen.findByText('Step 2b: Add token as');

      // Initially should show generate button
      expect(
        screen.getByRole('button', {name: 'Generate Repository Token'})
      ).toBeInTheDocument();

      // Should not show token initially
      expect(screen.queryByText('SENTRY_PREVENT_TOKEN')).not.toBeInTheDocument();

      // Mock the updated repo data with token after regeneration
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
        body: {
          ...mockRepoDataWithoutToken,
          uploadToken: 'new-generated-token-12345',
        },
      });

      // Click the generate button
      await userEvent.click(
        screen.getByRole('button', {name: 'Generate Repository Token'})
      );

      // Wait for the API call to complete
      await waitFor(() => {
        expect(regenerateTokenMock).toHaveBeenCalledWith(
          '/organizations/org-slug/prevent/owner/123/repository/test-repo/token/regenerate/',
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      // token should now be showing
      expect(await screen.findByText('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
      expect(screen.getByText('new-generated-token-12345')).toBeInTheDocument();
    });
  });

  describe('Regenerate Token', () => {
    it('show existing token and regenerates token on button click', async () => {
      const mockRepoDataWithToken = {
        testAnalyticsEnabled: false,
        uploadToken: 'old-generated-token-12345',
      };

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
        body: mockRepoDataWithToken,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prevent/owner/123/repository/test-repo/token/regenerate/',
        method: 'POST',
        body: {
          token: 'new-generated-token-12345',
        },
      });

      render(
        <PreventContext.Provider value={mockPreventContext}>
          <TestsOnboardingPage />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {opt: 'githubAction'},
            },
          },
        }
      );

      const uploadTokenRadio = await screen.findByLabelText(
        'Use Sentry Prevent Upload Token'
      );
      await userEvent.click(uploadTokenRadio);

      await screen.findByText('Step 2b: Add token as');

      expect(screen.getByRole('button', {name: 'Regenerate'})).toBeInTheDocument();

      expect(await screen.findByText('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
      expect(await screen.findByText('old-generated-token-12345')).toBeInTheDocument();

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
        body: {
          ...mockRepoDataWithToken,
          uploadToken: 'new-generated-token-12345',
        },
      });

      await userEvent.click(screen.getByRole('button', {name: 'Regenerate'}));

      expect(await screen.findByText('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
      expect(screen.getByText('new-generated-token-12345')).toBeInTheDocument();
    });
  });

  describe('when the organization is not in the US region', () => {
    it('navigates to the TA page with preonboarding alert and header text', async () => {
      mockGetRegionData.mockReturnValue({
        name: 'eu',
        displayName: 'European Union (EU)',
        url: 'https://eu.sentry.io',
      });

      // Mock API calls to prevent infinite navigation loop
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/`,
        body: [],
        method: 'GET',
        match: [MockApiClient.matchQuery({provider_key: 'github', includeConfig: 0})],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/123/repository/test-repo/`,
        body: {
          testAnalyticsEnabled: false,
          uploadToken: null,
        },
      });

      const {router} = render(
        <PreventContext.Provider value={mockPreventContext}>
          <TestsOnboardingPage />
        </PreventContext.Provider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tests/new',
              query: {},
            },
          },
        }
      );

      await waitFor(() => {
        expect(router.location.pathname).toBe('/prevent/tests');
      });
    });
  });
});
