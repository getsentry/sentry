import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {NoDocsOnboarding, UnsupportedPlatformOnboarding} from './onboarding';

describe('UnsupportedPlatformOnboarding', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('renders CopyMarkdownButton and flag-on copy when feature is enabled', () => {
    const organization = OrganizationFixture({
      features: ['onboarding-copy-setup-instructions'],
    });

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    expect(screen.getByRole('button', {name: 'Copy instructions'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can manually instrument your agents using the Sentry SDK tracing API, or click Copy instructions to have an AI coding agent do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders CopyLLMPromptButton and flag-off copy when feature is disabled', () => {
    const organization = OrganizationFixture();

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy instructions'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can manually instrument your agents using the Sentry SDK tracing API, or use an AI coding agent to do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    const organization = OrganizationFixture({
      features: ['onboarding-copy-setup-instructions'],
    });

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });

  it('copies LLM instructions to clipboard when CopyLLMPromptButton is clicked', async () => {
    const organization = OrganizationFixture();

    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Copy Prompt for AI Agent'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });
});

describe('NoDocsOnboarding', () => {
  const project = ProjectFixture();

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
  });

  it('renders CopyMarkdownButton and flag-on copy when feature is enabled', () => {
    const organization = OrganizationFixture({
      features: ['onboarding-copy-setup-instructions'],
    });

    render(<NoDocsOnboarding project={project} />, {organization});

    expect(screen.getByRole('button', {name: 'Copy instructions'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can set up the Sentry SDK by following our documentation, or click Copy instructions to have an AI coding agent do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders CopyLLMPromptButton and flag-off copy when feature is disabled', () => {
    const organization = OrganizationFixture();

    render(<NoDocsOnboarding project={project} />, {organization});

    expect(
      screen.getByRole('button', {name: 'Copy Prompt for AI Agent'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy instructions'})
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'You can set up the Sentry SDK by following our documentation, or use an AI coding agent to do it for you.'
        )
      )
    ).toBeInTheDocument();
  });

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    const organization = OrganizationFixture({
      features: ['onboarding-copy-setup-instructions'],
    });

    render(<NoDocsOnboarding project={project} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });

  it('copies LLM instructions to clipboard when CopyLLMPromptButton is clicked', async () => {
    const organization = OrganizationFixture();

    render(<NoDocsOnboarding project={project} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Copy Prompt for AI Agent'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });
});
