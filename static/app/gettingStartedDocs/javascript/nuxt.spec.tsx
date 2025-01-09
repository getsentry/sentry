import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs from './nuxt';

describe('javascript-nuxt onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Automatic Configuration (Recommended)'})
    ).toBeInTheDocument();
    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Manual Configuration'})
    ).toBeInTheDocument();
    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes configure statement
    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i nuxt/))
    ).toBeInTheDocument();
  });

  it('displays the verify instructions', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/sentry-example-page/))
    ).toBeInTheDocument();
  });
});
