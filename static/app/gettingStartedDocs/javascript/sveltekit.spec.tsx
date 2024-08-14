import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs from './sveltekit';

describe('javascript-sveltekit onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();

    // Includes configure statement
    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i sveltekit/))
    ).toBeInTheDocument();
  });

  it('displays the configure instructions', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/vite.config.js/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/src\/hooks.server.js/))
    ).toBeInTheDocument();
    expect(screen.queryByText(textWithMarkupMatcher(/.sentryclirc/))).toBeInTheDocument();
  });
});
