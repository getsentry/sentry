import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs from './minidump';

describe('GettingStartedWithSpring', function () {
  it('renders gradle docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Creating and Uploading Minidumps'})
    ).toBeInTheDocument();
  });
});
