import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/productSelection';

import docs from './nuxt';

describe('javascript-nuxt onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Upload Source Maps'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes 2 import statements
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/nuxt"/)
      )
    ).toHaveLength(2);
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(screen.getAllByText(textWithMarkupMatcher(/tracesSampleRate/))).toHaveLength(
      2
    ); // client and server
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate/))
    ).toBeInTheDocument(); // only client
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/))
    ).toBeInTheDocument(); // only client
  });

  it('enables performance setting the tracesSampleRate to 1', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(
      screen.getAllByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toHaveLength(2);
  });

  it('enables replay by setting replay samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate: 0\.1/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables profiling by setting profiling sample rates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.PROFILING],
    });

    expect(
      screen.getAllByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toHaveLength(2);
  });
});
