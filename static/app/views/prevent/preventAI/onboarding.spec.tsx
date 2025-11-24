import {ThemeProvider, type Theme} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';

import PreventAIOnboarding from './onboarding';

jest.mock('sentry-images/features/prevent-hero.svg', () => 'prevent-hero-mock.svg');
jest.mock(
  'sentry-images/features/prevent-pr-comments-light.svg',
  () => 'prevent-pr-comments-light-mock.svg',
  {virtual: true}
);
jest.mock(
  'sentry-images/features/prevent-pr-comments-dark.svg',
  () => 'prevent-pr-comments-dark-mock.svg',
  {virtual: true}
);
jest.mock('sentry/utils/analytics');

describe('PreventAIOnboarding', () => {
  const organization = OrganizationFixture({
    slug: 'test-org',
  });
  let configState: Config;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    configState = ConfigStore.getState();
    // Set up default regions for tests
    ConfigStore.set('regions', [
      {url: 'https://us.sentry.io', name: 'us'},
      {url: 'https://de.sentry.io', name: 'de'},
    ]);
  });

  afterEach(() => {
    // Restore ConfigStore to its previous state
    ConfigStore.loadInitialData(configState);
  });

  it('renders the main onboarding content', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByRole('heading', {
        name: 'Ship Code That Breaks Less With Code Reviews',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText('AI Code Review is an AI agent that automates tasks in your PR:')
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: 'Setup AI Code Review'})
    ).toBeInTheDocument();

    expect(
      screen.getByText('How to use AI Code Review', {exact: false})
    ).toBeInTheDocument();
  });

  it('renders both onboarding steps', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Enable AI Code Review features'})
    ).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Setup GitHub Integration'})
    ).toBeInTheDocument();
  });

  it('renders external links with correct hrefs', async () => {
    render(<PreventAIOnboarding />, {organization});

    const orgSettingsLink = screen.getByRole('link', {name: 'organization settings'});
    expect(orgSettingsLink).toHaveAttribute('href', '/settings/test-org/#hideAiFeatures');
    await userEvent.click(orgSettingsLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'prevent.ai_onboarding.settings_link.clicked',
      {organization}
    );

    const sentryGitHubAppLink = screen.getByRole('link', {
      name: 'Sentry GitHub App',
    });
    expect(sentryGitHubAppLink).toHaveAttribute(
      'href',
      '/settings/test-org/integrations/github/'
    );
    await userEvent.click(sentryGitHubAppLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'prevent.ai_onboarding.github_integration_link.clicked',
      {organization}
    );

    const githubIntegrationLink = screen.getByRole('link', {
      name: 'GitHub integration',
    });
    expect(githubIntegrationLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#installing-github'
    );
    await userEvent.click(githubIntegrationLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'prevent.ai_onboarding.github_docs_link.clicked',
      {organization}
    );

    const learnMoreLink = screen.getByRole('link', {name: 'Learn more'});
    expect(learnMoreLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/ai-in-sentry/ai-code-review/'
    );
    await userEvent.click(learnMoreLink);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'prevent.ai_onboarding.ai_code_review_docs_link.clicked',
      {organization}
    );
  });

  it('renders feature list items', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText(
        'It reviews your pull requests, predicting errors and suggesting code fixes.'
      )
    ).toBeInTheDocument();
  });

  it('renders how to use feature descriptions', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText('AI Code Review helps you ship better code with new features:')
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'It reviews your code, suggesting broader fixes when you prompt @sentry review.'
        )
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'It predicts which errors your code will cause. This happens automatically when you mark a PR ready for review, and when you trigger a PR review with @sentry review.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders images with correct alt text', () => {
    render(<PreventAIOnboarding />, {organization});

    const heroImage = screen.getByAltText('AI Code Review Hero');
    expect(heroImage).toBeInTheDocument();

    const prCommentsImage = screen.getByAltText('Prevent PR Comments');
    expect(prCommentsImage).toBeInTheDocument();
    expect(prCommentsImage).toHaveAttribute('src', 'prevent-pr-comments-light-mock.svg');
  });

  it('renders admin notice text', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText(
        `These setups must be installed or approved by an admin. If you're not an admin, reach out to your organization's admins to ensure they approve the installation.`
      )
    ).toBeInTheDocument();
  });

  it('renders sentry error prediction notice', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText(
        'Sentry Error Prediction works better with Sentry Issue Context.',
        {exact: false}
      )
    ).toBeInTheDocument();
  });

  it('has proper semantic structure with headings', () => {
    render(<PreventAIOnboarding />, {organization});

    const stepHeadings = screen.getAllByRole('heading', {level: 3});
    expect(stepHeadings).toHaveLength(2);

    expect(stepHeadings[0]).toHaveTextContent('Enable AI Code Review features');
    expect(stepHeadings[1]).toHaveTextContent('Setup GitHub Integration');
  });

  describe('step descriptions', () => {
    it('renders step 1 description with organization link', () => {
      render(<PreventAIOnboarding />, {organization});

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'An organization admin needs to turn on two toggles: Enable AI Code Review and Show Generative AI Features in your organization settings.'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders step 1 description with italic text components', () => {
      render(<PreventAIOnboarding />, {organization});

      // Check that the italic text components are rendered
      const enablePreventAIText = screen.getByText('Enable AI Code Review');
      const showGenerativeAIText = screen.getByText('Show Generative AI Features');

      expect(enablePreventAIText).toBeInTheDocument();
      expect(showGenerativeAIText).toBeInTheDocument();

      // Verify they are span elements (default for Text component)
      expect(enablePreventAIText.tagName).toBe('SPAN');
      expect(showGenerativeAIText.tagName).toBe('SPAN');
    });

    it('renders step 2 description with GitHub instructions', () => {
      render(<PreventAIOnboarding />, {organization});

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Install the Sentry GitHub App to connect your GitHub repositories and enable AI Code Review to access your codebase. Learn more about GitHub integration.'
          )
        )
      ).toBeInTheDocument();
    });
  });

  it.each([
    [{type: 'dark'}, 'prevent-pr-comments-dark-mock.svg'],
    [{type: 'light'}, 'prevent-pr-comments-light-mock.svg'],
  ])('renders the correct image in %p theme', (theme, expectedSrc) => {
    render(
      <ThemeProvider theme={theme as Theme}>
        <PreventAIOnboarding />
      </ThemeProvider>,
      {organization}
    );
    const prCommentsImage = screen.getByAltText('Prevent PR Comments');
    expect(prCommentsImage).toBeInTheDocument();
    expect(prCommentsImage).toHaveAttribute('src', expectedSrc);
  });
});
