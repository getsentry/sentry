import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from './switch';

describe('Nintendo onboarding docs', function () {
  it('renders docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Configure SDK'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Verify'})).not.toBeInTheDocument();
  });
});
