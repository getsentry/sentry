import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import docs from './remix';

describe('javascript-remix onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Automatic Configuration (Recommended)'})
    ).toBeInTheDocument();

    // Includes configure statement
    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i remix/))
    ).toBeInTheDocument();
  });
});
