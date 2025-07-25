import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import docs from './nextjs';

describe('javascript-nextjs onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(
      screen.getByRole('heading', {name: 'Automatic Configuration (Recommended)'})
    ).toBeInTheDocument();

    // Includes configure statement
    expect(
      screen.getByText(textWithMarkupMatcher(/npx @sentry\/wizard@latest -i nextjs/))
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

  it('enables logs by setting enableLogs to true', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/enableLogs: true/))
    ).toBeInTheDocument();
  });

  it('shows Logging Integrations in next steps when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.LOGS,
      ],
    });

    expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
  });

  it('does not show Logging Integrations in next steps when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.queryByText('Logging Integrations')).not.toBeInTheDocument();
  });
});
