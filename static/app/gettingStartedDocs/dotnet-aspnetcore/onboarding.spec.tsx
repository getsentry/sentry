import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from './index';

describe('aspnetcore onboarding docs', () => {
  it('renders errors onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      releaseRegistry: {
        'sentry.dotnet.aspnetcore': {
          version: '1.99.9',
        },
      },
      selectedProducts: [
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.LOGS,
        ProductSolution.METRICS,
      ],
    });

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Tracing'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Samples'})).toBeInTheDocument();

    // Renders SDK version from registry
    expect(
      await screen.findByText(
        textWithMarkupMatcher(/Install-Package Sentry.AspNetCore -Version 1\.99\.9/)
      )
    ).toBeInTheDocument();
  });

  it('renders the WebApplication configuration by default', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/builder\.WebHost\.UseSentry\(/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/var app = builder\.Build\(\);/))
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/CreateHostBuilder/))
    ).not.toBeInTheDocument();
  });

  it('renders performance onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/o.TracesSampleRate/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        textWithMarkupMatcher(/app\.MapGet\("\/person\/\{id\}", \(string id, IHub hub\)/)
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/Startup\.cs/))
    ).not.toBeInTheDocument();
  });

  it('renders logs onboarding docs correctly', async () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.LOGS],
    });

    expect(
      await screen.findByText(textWithMarkupMatcher(/o.EnableLogs/))
    ).toBeInTheDocument();
  });
});
