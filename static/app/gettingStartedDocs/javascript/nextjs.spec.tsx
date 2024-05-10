import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs from './nextjs';

describe('javascript-nextjs onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();

    // Includes configure statement
    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i nextjs/))
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
      screen.queryByText(textWithMarkupMatcher(/sentry.client.config.js/))
    ).toBeInTheDocument();
    expect(screen.queryByText(textWithMarkupMatcher(/Sentry.init/))).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/.env.sentry-build-plugin/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/instrumentation.ts/))
    ).toBeInTheDocument();
  });
});
