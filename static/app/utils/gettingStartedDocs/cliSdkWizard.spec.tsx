import {getWizardSnippet} from './cliSdkWizard';

// Mock the getPackageVersion function
jest.mock('./getPackageVersion', () => ({
  getPackageVersion: jest.fn(() => '4.2.1'),
}));

describe('cliSdkWizard', function () {
  // Create a complete DocsParams mock
  const mockParams = {
    api: {},
    dsn: {
      public: 'https://example.com',
      secret: 'secret',
      projectId: '123',
    },
    isFeedbackSelected: false,
    isPerformanceSelected: false,
    isProfilingSelected: false,
    isReplaySelected: false,
    isSelfHosted: false,
    organization: {
      slug: 'test-org',
    },
    project: {
      slug: 'test-project',
    },
    projectSlug: 'test-project',
  } as any; // Cast to any to avoid needing to fully implement DocsParams

  it('generates wizard snippets for JavaScript frameworks', function () {
    const snippets = getWizardSnippet({
      platform: 'nextjs',
      params: mockParams,
    });

    // Should not include brew for JavaScript frameworks
    const brewSnippet = snippets.find(snippet => snippet.label === 'brew');
    expect(brewSnippet).toBeUndefined();

    // Verify the npx snippet
    const npxSnippet = snippets.find(snippet => snippet.label === 'npx');
    expect(npxSnippet?.code).toContain(
      'npx @sentry/wizard@latest -i nextjs --saas --org test-org --project test-project'
    );
  });

  it('generates wizard snippets for mobile platforms with brew option', function () {
    const mobilePlatforms = ['ios', 'android', 'flutter', 'reactNative'];

    mobilePlatforms.forEach(platform => {
      const snippets = getWizardSnippet({
        platform,
        params: mockParams,
      });

      // Should include brew for mobile platforms
      const brewSnippet = snippets.find(snippet => snippet.label === 'brew');
      expect(brewSnippet).toBeDefined();
      expect(brewSnippet?.code).toContain(`sentry-wizard -i ${platform} --saas`);

      // Verify the npx snippet
      const npxSnippet = snippets.find(snippet => snippet.label === 'npx');
      expect(npxSnippet?.code).toContain(
        `npx @sentry/wizard@latest -i ${platform} --saas`
      );
    });
  });

  it('handles self-hosted environments correctly', function () {
    const selfHostedParams = {
      ...mockParams,
      isSelfHosted: true,
    };

    const snippets = getWizardSnippet({
      platform: 'nextjs',
      params: selfHostedParams,
    });

    // Should not include the --saas flag
    const npxSnippet = snippets.find(snippet => snippet.label === 'npx');
    expect(npxSnippet?.code).not.toContain('--saas');
    expect(npxSnippet?.code).toContain(
      'npx @sentry/wizard@latest -i nextjs  --org test-org --project test-project'
    );
  });

  it('uses the provided SDK version from the release registry', function () {
    const snippets = getWizardSnippet({
      platform: 'nextjs',
      params: mockParams,
    });

    // Verify the macOS Intel snippet uses the version from the registry
    const macosSnippet = snippets.find(snippet => snippet.label === 'macOS (Intel/x64)');
    expect(macosSnippet?.code).toContain('v4.2.1');
  });
});
