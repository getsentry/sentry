import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-remix onboarding docs', () => {
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

  it('has metrics onboarding configuration', () => {
    expect(docs.metricsOnboarding).toBeDefined();
    expect(docs.metricsOnboarding?.install).toBeDefined();
    expect(docs.metricsOnboarding?.configure).toBeDefined();
    expect(docs.metricsOnboarding?.verify).toBeDefined();
  });

  it('does not show Metrics in next steps when metrics is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.queryByText('Metrics')).not.toBeInTheDocument();
  });
});
