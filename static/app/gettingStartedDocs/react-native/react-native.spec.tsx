import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from './react-native';

describe('GettingStartedWithSpring', function () {
  it('renders docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Performance'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Debug Symbols'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Source Context'})).toBeInTheDocument();
  });
});
