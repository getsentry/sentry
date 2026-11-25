import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('elixir onboarding docs', () => {
  it('renders docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Package Source Code'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Setup for Plug and Phoenix Applications'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Capture Crashed Process Exceptions'})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('installs the current SDK with Finch', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/\{:sentry, "~> 14\.1"\}/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/\{:finch, "~> 0\.21"\}/))
    ).toBeInTheDocument();
    expect(screen.queryByText(textWithMarkupMatcher(/:hackney/))).not.toBeInTheDocument();
  });

  it('enables logs with the logs level instead of enable_logs', async () => {
    renderWithOnboardingLayout(
      {onboarding: docs.logsOnboarding!},
      {selectedProducts: [ProductSolution.LOGS]}
    );

    expect(
      await screen.findByText(textWithMarkupMatcher(/\{:sentry, "~> 14\.1"\}/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/logs: \[\s*level: :info/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/enable_logs/))
    ).not.toBeInTheDocument();
  });
});
