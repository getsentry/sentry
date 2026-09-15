import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {docs} from '.';

describe('javascript-ember onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: /Upload Source Maps/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    expect(
      screen.getByText(textWithMarkupMatcher(/import \* as Sentry from "@sentry\/ember"/))
    ).toBeInTheDocument();
  });

  it('initializes the SDK directly and loads application initializers', () => {
    renderWithOnboardingLayout(docs);

    const setup = screen.getByText(textWithMarkupMatcher(/Sentry\.init\(/));
    expect(setup).toHaveTextContent('import config from "./config/environment"');
    expect(setup).toHaveTextContent('loadInitializers(App, config.modulePrefix)');
    expect(setup).toHaveTextContent('dataCollection:');
    expect(setup).not.toHaveTextContent(/sendDefaultPii|enableLogs|enableMetrics/);
  });

  it('registers a performance instance initializer when tracing is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.PERFORMANCE_MONITORING],
    });

    const initializer = screen.getByText(
      textWithMarkupMatcher(/export function initialize\(appInstance\)/)
    );
    expect(initializer).toHaveTextContent(
      'import { instrumentAppInstancePerformance } from "@sentry/ember"'
    );
    expect(initializer).toHaveTextContent(
      'instrumentAppInstancePerformance(appInstance)'
    );
    expect(initializer).toHaveTextContent('export default { initialize }');
  });

  it('omits performance instrumentation when tracing is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/instrumentAppInstancePerformance/))
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(textWithMarkupMatcher(/tracesSampleRate/))
    ).not.toBeInTheDocument();
  });

  it('verifies errors with a component action and button', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    const component = screen.getByText(textWithMarkupMatcher(/throw new Error/));
    expect(component).toHaveTextContent('extends Component');
    expect(component).toHaveTextContent(/@action\s*triggerError\(\)/);
    expect(component).not.toHaveTextContent(/setTimeout|@sentry\/ember/);
    expect(
      screen.getByText(textWithMarkupMatcher(/\{\{on "click" this\.triggerError\}\}/))
    ).toHaveTextContent('Break the world');
  });

  it('sends both selected signals before the verification error', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.LOGS,
        ProductSolution.METRICS,
      ],
    });

    const component = screen.getByText(textWithMarkupMatcher(/throw new Error/));
    expect(component).toHaveTextContent('import * as Sentry from "@sentry/ember"');
    expect(component).toHaveTextContent(
      /Sentry\.logger\.info.*Sentry\.metrics\.count.*throw new Error/
    );
  });

  it('displays sample rates by default', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.SESSION_REPLAY,
      ],
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
      screen.getByText(textWithMarkupMatcher(/Sentry.browserProfilingIntegration\(\)/))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher(/profileSessionSampleRate: 1\.0/))
    ).toBeInTheDocument();
  });

  it('shows Configure Ember Options in next steps', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(screen.getByText('Configure Ember Options')).toBeInTheDocument();
  });

  it('shows Logging Integrations in next steps when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
        ProductSolution.LOGS,
      ],
    });

    expect(screen.getByText('Configure Ember Options')).toBeInTheDocument();
    expect(screen.getByText('Logging Integrations')).toBeInTheDocument();
  });

  it('does not show Logging Integrations in next steps when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [
        ProductSolution.ERROR_MONITORING,
        ProductSolution.PERFORMANCE_MONITORING,
      ],
    });

    expect(screen.getByText('Configure Ember Options')).toBeInTheDocument();
    expect(screen.queryByText('Logging Integrations')).not.toBeInTheDocument();
  });

  it('includes logging code in verify snippet when logs is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.LOGS],
    });

    expect(
      screen.getByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).toBeInTheDocument();
    // Import appears in configure and verify steps when logs are selected
    expect(
      screen.getAllByText(
        textWithMarkupMatcher(/import \* as Sentry from "@sentry\/ember"/)
      )
    ).toHaveLength(2);
  });

  it('excludes logging code in verify snippet when logs is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(textWithMarkupMatcher(/Sentry\.logger\.info/))
    ).not.toBeInTheDocument();
  });

  it('includes metrics code in verify snippet when metrics is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
    });

    expect(
      screen.getByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).toBeInTheDocument();
  });

  it('excludes metrics code in verify snippet when metrics is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(
      screen.queryByText(
        textWithMarkupMatcher(/Sentry\.metrics\.count\('test_counter', 1\)/)
      )
    ).not.toBeInTheDocument();
  });

  it('shows Metrics in next steps when metrics is selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ProductSolution.METRICS],
    });

    expect(screen.getByText('Configure Ember Options')).toBeInTheDocument();
    expect(screen.getByText('Application Metrics')).toBeInTheDocument();
  });

  it('does not show Metrics in next steps when metrics is not selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    expect(screen.getByText('Configure Ember Options')).toBeInTheDocument();
    expect(screen.queryByText('Application Metrics')).not.toBeInTheDocument();
  });
});
