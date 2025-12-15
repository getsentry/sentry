import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from '.';

describe('javascript-react-router onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Automatic Configuration (Recommended)'})
    ).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i reactRouter/))
    ).toBeInTheDocument();
  });

  it('displays the verify instructions', () => {
    renderWithOnboardingLayout(docs);

    // Shows sentry-example-page instruction
    expect(
      screen.getByText(textWithMarkupMatcher(/visit \/sentry-example-page/))
    ).toBeInTheDocument();

    // Shows alternative verification method
    expect(
      screen.getByText(textWithMarkupMatcher(/myUndefinedFunction\(\)/))
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
