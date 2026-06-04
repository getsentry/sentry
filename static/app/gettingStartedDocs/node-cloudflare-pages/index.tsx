import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {agentMonitoring} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {featureFlag} from 'sentry/gettingStartedDocs/node/featureFlag';

import {crashReport} from './crashReport';
import {logs} from './logs';
import {mcp} from './mcp';
import {metrics} from './metrics';
import {onboarding} from './onboarding';

export const docs: Docs = {
  onboarding,
  crashReportOnboarding: crashReport,
  featureFlagOnboarding: featureFlag({
    packageName: '@sentry/cloudflare',
  }),
  logsOnboarding: logs,
  agentMonitoringOnboarding: agentMonitoring({
    packageName: '@sentry/cloudflare',
  }),
  mcpOnboarding: mcp,
  metricsOnboarding: metrics,
};
