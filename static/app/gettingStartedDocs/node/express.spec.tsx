import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs from './express';

describe('express onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Upload Source Maps'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    const allMatches = screen.getAllByText(
      textWithMarkupMatcher(/import \* as Sentry from "@sentry\/node"/)
    );
    allMatches.forEach(match => {
      expect(match).toBeInTheDocument();
    });
  });

  it('includes error handler', () => {
    renderWithOnboardingLayout(docs);

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.setupExpressErrorHandler\(app\)/))
    ).toBeInTheDocument();
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.PROFILING,
      ],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/profilesSampleRate/))
    ).toBeInTheDocument();
  });

  it('enables performance setting the tracesSampleRate to 1', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables profiling by setting profiling samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /const { nodeProfilingIntegration } = require\("@sentry\/profiling-node"\)/
        )
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });
});
