import {renderWithOnboardingLayout} from 'sentry-test/onboarding/renderWithOnboardingLayout';
import {screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';

import {VueVersion} from './utils';
import {docs} from '.';

describe('javascript-vue onboarding docs', () => {
  it('renders onboarding docs correctly', () => {
    renderWithOnboardingLayout(docs);

    // Renders main headings
    expect(screen.getByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: /Upload Source Maps/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();

    // Includes import statement
    expect(
      screen.getByText(textWithMarkupMatcher(/import \* as Sentry from "@sentry\/vue"/))
    ).toBeInTheDocument();
  });

  it('initializes Vue 3 with the root component and existing router', () => {
    renderWithOnboardingLayout(docs);

    const setup = screen.getByText(textWithMarkupMatcher(/Sentry\.init\(/));
    expect(setup).toHaveTextContent('import App from "./App.vue"');
    expect(setup).toHaveTextContent('import router from "./router"');
    expect(setup).toHaveTextContent('const app = createApp(App)');
    expect(setup).toHaveTextContent('app.use(router)');
    expect(setup).not.toHaveTextContent('createRouter');
  });

  it('keeps Vue 2 setup with its constructor and root component', () => {
    renderWithOnboardingLayout(docs, {
      selectedOptions: {siblingOption: VueVersion.VUE2},
    });

    const setup = screen.getByText(textWithMarkupMatcher(/Sentry\.init\(/));
    expect(setup).toHaveTextContent('import Vue from "vue"');
    expect(setup).toHaveTextContent('import App from "./App.vue"');
    expect(setup).toHaveTextContent('Vue.use(Router)');
    expect(setup).toHaveTextContent(/Sentry\.init\(\{\s*Vue,/);
    expect(setup).toHaveTextContent('render: (h) => h(App)');
  });

  it.each([
    {products: [ProductSolution.LOGS]},
    {products: [ProductSolution.METRICS]},
    {products: [ProductSolution.LOGS, ProductSolution.METRICS]},
  ])('verifies selected signals: $products', ({products}) => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING, ...products],
    });

    const verify = screen.getByText(textWithMarkupMatcher(/throw new Error/));
    expect(verify).toHaveTextContent('import * as Sentry from "@sentry/vue"');
    expect(verify.textContent?.includes('Sentry.logger.info')).toBe(
      products.includes(ProductSolution.LOGS)
    );
    expect(verify.textContent?.includes('Sentry.metrics.count')).toBe(
      products.includes(ProductSolution.METRICS)
    );

    const setup = screen.getByText(textWithMarkupMatcher(/Sentry\.init\(/));
    expect(setup).toHaveTextContent('dataCollection:');
    expect(setup).not.toHaveTextContent(/sendDefaultPii|enableLogs|enableMetrics/);
  });

  it.each([VueVersion.VUE2, VueVersion.VUE3])(
    'shows a clickable verification component for %s',
    siblingOption => {
      renderWithOnboardingLayout(docs, {
        selectedOptions: {siblingOption},
        selectedProducts: [ProductSolution.ERROR_MONITORING],
      });

      const verify = screen.getByText(textWithMarkupMatcher(/throw new Error/));
      expect(verify).toHaveTextContent('<script>');
      expect(verify).toHaveTextContent(/methods:\s*\{\s*triggerError\(\)/);
      expect(verify).toHaveTextContent('<template>');
      expect(verify).toHaveTextContent(
        '<button type="button" @click="triggerError">Break the world</button>'
      );
    }
  );

  it('omits signal APIs and imports when only errors are selected', () => {
    renderWithOnboardingLayout(docs, {
      selectedProducts: [ProductSolution.ERROR_MONITORING],
    });

    const verify = screen.getByText(textWithMarkupMatcher(/throw new Error/));
    expect(verify).not.toHaveTextContent(/import|Sentry\.logger|Sentry\.metrics/);
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

    expect(screen.queryByText('Application Metrics')).not.toBeInTheDocument();
  });
});
