import type {Docs} from 'sentry/components/onboarding/gettingStartedDoc/types';
// Bref apps use the Sentry SDK for PHP, so the product-specific onboarding is
// shared with PHP.
import {crashReport} from 'sentry/gettingStartedDocs/php/crashReport';
import {logs} from 'sentry/gettingStartedDocs/php/logs';
import {metrics} from 'sentry/gettingStartedDocs/php/metrics';

import {onboarding} from './onboarding';
import {platformOptions, type PlatformOptions} from './utils';

export const docs: Docs<PlatformOptions> = {
  onboarding,
  platformOptions,
  crashReportOnboarding: crashReport,
  logsOnboarding: logs,
  metricsOnboarding: metrics,
};
