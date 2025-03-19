import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import docs, {
  ReactRouterVersion,
  RouterType,
} from 'sentry/gettingStartedDocs/javascript/react';

describe('javascript-react onboarding docs', function () {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs, {
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getByText(textWithMarkupMatcher(/import \* as Sentry from "@sentry\/react"/))
    ).toBeInTheDocument();

    // Includes sourcemaps wizard command in the upload source maps section with org and project slugs
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          /npx @sentry\/wizard@latest -i sourcemaps --saas --org test-org --project test-project/
        )
      )
    ).toBeInTheDocument();
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysSessionSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/replaysOnErrorSampleRate/))
    ).toBeInTheDocument();
  });

  it('enables performance setting the tracesSampleRate to 1', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tracesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('enables replay by setting replay samplerates', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
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
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry.browserProfilingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profilesSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('includes React Router v6 integration when performance and React Router are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      platformOptions: {
        routerType: RouterType.REACT_ROUTER,
        reactRouterVersion: ReactRouterVersion.V6,
      },
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/reactRouterV6BrowserTracingIntegration/))
    ).toBeInTheDocument();
    expect(screen.getByText(textWithMarkupMatcher(/useLocation/))).toBeInTheDocument();
  });

  it('includes React Router v7 integration when performance and React Router are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      platformOptions: {
        routerType: RouterType.REACT_ROUTER,
        reactRouterVersion: ReactRouterVersion.V7,
      },
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/reactRouterV7BrowserTracingIntegration/))
    ).toBeInTheDocument();
  });

  it('includes tanstack Router integration when performance and Tanstack Router are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      platformOptions: {
        routerType: RouterType.TANSTACK_ROUTER,
      },
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/tanstackRouterBrowserTracingIntegration/))
    ).toBeInTheDocument();
  });

  it('does not include router integrations when performance is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
      platformOptions: {
        routerType: RouterType.REACT_ROUTER,
        reactRouterVersion: ReactRouterVersion.V6,
      },
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    // Should not include any router integration
    expect(
      screen.queryByText(textWithMarkupMatcher(/reactRouterV6BrowserTracingIntegration/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/useLocation/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/tanstackRouterBrowserTracingIntegration/))
    ).not.toBeInTheDocument();

    // Should not include tracing code
    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).not.toBeInTheDocument();
  });

  it('does not display router options when performance is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    // Router types should not be visible
    expect(screen.queryByRole('radio', {name: 'React Router'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {name: 'Tanstack Router'})
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'No Router'})).not.toBeInTheDocument();

    // Version options should not be visible
    expect(screen.queryByRole('radio', {name: 'v7 (Latest)'})).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'v6'})).not.toBeInTheDocument();
  });

  it('displays router options when performance is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
      organization: {slug: 'test-org'},
      projectSlug: 'test-project',
    });

    // Router types should be visible
    expect(screen.getByRole('radio', {name: 'React Router'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Tanstack Router'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'No Router'})).toBeInTheDocument();
  });
});
