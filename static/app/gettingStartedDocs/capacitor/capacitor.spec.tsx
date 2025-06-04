import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import docs, {SiblingOption} from './capacitor';

describe('capacitor onboarding docs', function () {
  it('renders docs correctly', function () {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  for (const enumMember in SiblingOption) {
    it(`renders capacitor docs correctly with sibling ${enumMember}`, function () {
      renderWithOnboardingLayout(docs, {
        selectedOptions: {
          siblingOption: enumMember,
        },
      });

      // Renders main headings
      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    });
  }
});
