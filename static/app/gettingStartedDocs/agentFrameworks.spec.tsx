import {docs as eveDocs} from 'sentry/gettingStartedDocs/node-eve';
import {docs as flueDocs} from 'sentry/gettingStartedDocs/node-flue';
import {docs as mastraDocs} from 'sentry/gettingStartedDocs/node-mastra';
import {
  eveOnboarding,
  flueOnboarding,
  mastraOnboarding,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';

describe('agent framework getting started docs', () => {
  it.each([
    ['Eve', eveDocs, eveOnboarding],
    ['Flue', flueDocs, flueOnboarding],
    ['Mastra', mastraDocs, mastraOnboarding],
  ] as const)(
    'uses dedicated %s setup while retaining Node product docs',
    (_name, docs, onboarding) => {
      expect(docs.onboarding).toBe(onboarding);
      expect(docs.logsOnboarding).toBeDefined();
      expect(docs.metricsOnboarding).toBeDefined();
      expect(docs.profilingOnboarding).toBeDefined();
      expect(docs.agentMonitoringOnboarding).toBeDefined();
    }
  );
});
