import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from '.';

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
});
