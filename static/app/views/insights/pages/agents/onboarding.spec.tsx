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

  it('renders CopyMarkdownButton and copy instructions text', () => {
    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />);

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

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    render(<UnsupportedPlatformOnboarding project={project} platformName="ruby" />);

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

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

  it('renders CopyMarkdownButton and copy instructions text', () => {
    render(<NoDocsOnboarding project={project} />);

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

  it('copies LLM instructions to clipboard when CopyMarkdownButton is clicked', async () => {
    render(<NoDocsOnboarding project={project} />);

    await userEvent.click(screen.getByRole('button', {name: 'Copy instructions'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Instrument Sentry AI Agent Monitoring')
    );
  });
});
