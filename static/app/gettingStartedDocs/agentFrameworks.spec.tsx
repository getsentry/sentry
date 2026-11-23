import {onboarding as eveOnboarding} from './node-eve/onboarding';
import {onboarding as flueOnboarding} from './node-flue/onboarding';
import {onboarding as mastraOnboarding} from './node-mastra/onboarding';
import {onboarding as piOnboarding} from './node-pi-durable/onboarding';
import {docs as eveDocs} from './node-eve';
import {docs as flueDocs} from './node-flue';
import {docs as mastraDocs} from './node-mastra';
import {docs as piDocs} from './node-pi-durable';

describe('agent framework getting started docs', () => {
  it.each([
    ['Eve', eveDocs, eveOnboarding],
    ['Flue', flueDocs, flueOnboarding],
    ['Mastra', mastraDocs, mastraOnboarding],
    ['Pi Durable', piDocs, piOnboarding],
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
