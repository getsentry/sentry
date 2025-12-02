import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';

import {SiblingOption} from './utils';
import docs from '.';

describe('capacitor onboarding docs', () => {
  it('renders docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  for (const enumMember in SiblingOption) {
    it(`renders capacitor docs correctly with sibling ${enumMember}`, () => {
      renderWithOnboardingLayout(docs, {
        selectedOptions: {
          siblingOption: enumMember as SiblingOption,
        },
      });

      // Renders main headings
      expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
      expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    });
  }
});
