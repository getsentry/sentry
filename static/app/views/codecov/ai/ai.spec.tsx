import {render, screen} from 'sentry-test/reactTestingLibrary';

import AIPage from 'sentry/views/codecov/ai/ai';

describe('AIPage', () => {
  it('renders the main heading', () => {
    render(<AIPage />);

    expect(
      screen.getByText('Ship Code That Breaks Less With Code Reviews And Tests')
    ).toBeInTheDocument();
  });

  it('renders the Prevent AI description', () => {
    render(<AIPage />);

    expect(
      screen.getByText(
        'Prevent AI is a generative AI agent that automates tasks in your PR:'
      )
    ).toBeInTheDocument();
  });

  it('renders the feature list items', () => {
    render(<AIPage />);

    expect(
      screen.getByText(
        'It reviews your pull request, predicting errors and suggesting code fixes.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('It generates unit tests for untested code in your PR.')
    ).toBeInTheDocument();
  });

  it('renders the setup guide section', () => {
    render(<AIPage />);

    expect(screen.getByText('Set up Prevent AI')).toBeInTheDocument();
    expect(
      screen.getByText(
        "These setups must be installed or approved by an admin. If you're not an admin, reach out to your organization's admins to ensure they approve the installation."
      )
    ).toBeInTheDocument();
  });

  it('renders all setup steps', () => {
    render(<AIPage />);

    expect(screen.getByText('Enable Generative AI features')).toBeInTheDocument();
    expect(screen.getByText('Set Up GitHub Integration')).toBeInTheDocument();
    expect(screen.getByText('Set Up Seer')).toBeInTheDocument();
  });

  it('renders the usage instructions', () => {
    render(<AIPage />);

    expect(screen.getByText('How to use Prevent AI')).toBeInTheDocument();
    expect(
      screen.getByText('Prevent AI helps you ship better code with three features:')
    ).toBeInTheDocument();
    expect(screen.getByText('@sentry review')).toBeInTheDocument();
    expect(screen.getByText('@sentry generate-test')).toBeInTheDocument();
  });
});
