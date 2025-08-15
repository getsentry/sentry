import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import PreventAIOnboarding from './onboarding';

jest.mock('sentry-images/features/prevent-hero.svg', () => 'prevent-hero-mock.svg');
jest.mock(
  'sentry-images/features/prevent-pr-comment.png',
  () => 'prevent-pr-comment-mock.png'
);

describe('PreventAIOnboarding', () => {
  const organization = OrganizationFixture({
    slug: 'test-org',
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the main onboarding content', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByRole('heading', {
        name: 'Ship Code That Breaks Less With Code Reviews And Tests',
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText('Prevent AI is an AI agent that automates tasks in your PR:')
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', {name: 'Setup Prevent AI'})).toBeInTheDocument();

    expect(screen.getByText('How to use Prevent AI', {exact: false})).toBeInTheDocument();
  });

  it('renders all three onboarding steps', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Enable Generative AI features'})
    ).toBeInTheDocument();

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Setup GitHub Integration'})
    ).toBeInTheDocument();

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Setup Seer'})).toBeInTheDocument();
  });

  it('renders external links with correct hrefs', () => {
    render(<PreventAIOnboarding />, {organization});

    const orgSettingsLink = screen.getByRole('link', {name: 'organization settings'});
    expect(orgSettingsLink).toHaveAttribute('href', '/settings/test-org');

    const githubIntegrationLink = screen.getByRole('link', {
      name: 'GitHub integration instructions',
    });
    expect(githubIntegrationLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/organization/integrations/source-code-mgmt/github/#installing-github'
    );

    const seerLink = screen.getByRole('link', {name: 'Seer by Sentry GitHub App'});
    expect(seerLink).toHaveAttribute('href', 'https://github.com/apps/seer-by-sentry');

    const learnMoreLink = screen.getByRole('link', {name: 'Learn more'});
    expect(learnMoreLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/ai-in-sentry/sentry-prevent-ai/'
    );
  });

  it('renders feature list items', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText(
        'It reviews your pull requests, predicting errors and suggesting code fixes.'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText('It generates unit tests for untested code in your PR.')
    ).toBeInTheDocument();
  });

  it('renders how to use feature descriptions', () => {
    render(<PreventAIOnboarding />, {organization});

    expect(
      screen.getByText('Prevent AI helps you ship better code with three features:')
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

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'It generates unit tests for your PR when you prompt @sentry generate-test.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders images with correct alt text', () => {
    render(<PreventAIOnboarding />, {organization});

    const heroImage = screen.getByAltText('Prevent AI Hero');
    expect(heroImage).toBeInTheDocument();

    const prCommentImage = screen.getByAltText('Prevent PR Comment');
    expect(prCommentImage).toBeInTheDocument();
    expect(prCommentImage).toHaveAttribute('src', 'prevent-pr-comment-mock.png');
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
    expect(stepHeadings).toHaveLength(3);

    expect(stepHeadings[0]).toHaveTextContent('Enable Generative AI features');
    expect(stepHeadings[1]).toHaveTextContent('Setup GitHub Integration');
    expect(stepHeadings[2]).toHaveTextContent('Setup Seer');
  });

  describe('step descriptions', () => {
    it('renders step 1 description with organization link', () => {
      render(<PreventAIOnboarding />, {organization});

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Make sure AI features are enabled in your organization settings.'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders step 2 description with GitHub instructions', () => {
      render(<PreventAIOnboarding />, {organization});

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'To grant Seer access to your codebase, follow these GitHub integration instructions: 1. Install the Sentry GitHub app. 2. Connect your GitHub repositories.'
          )
        )
      ).toBeInTheDocument();
    });

    it('renders step 3 description with Seer app link', () => {
      render(<PreventAIOnboarding />, {organization});

      expect(
        screen.getByText(
          textWithMarkupMatcher(
            'Prevent AI uses the Sentry Seer agent to power its core functionalities. Install the Seer by Sentry GitHub App within the same GitHub organization.'
          )
        )
      ).toBeInTheDocument();
    });
  });
});
