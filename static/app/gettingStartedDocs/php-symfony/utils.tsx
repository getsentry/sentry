import {ExternalLink} from 'sentry/components/core/link';
import type {
  ContentBlock,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const getExcimerInstallSteps = (params: DocsParams): ContentBlock[] => {
  if (!params.isProfilingSelected) {
    return [];
  }

  return [
    {
      type: 'text',
      text: t('Install the Excimer extension via PECL:'),
    },
    {
      type: 'code',
      language: 'bash',
      code: 'pecl install excimer',
    },
    {
      type: 'text',
      text: tct(
        "The Excimer PHP extension supports PHP 7.2 and up. Excimer requires Linux or macOS and doesn't support Windows. For additional ways to install Excimer, see [sentryPhpDocumentationLink: Sentry documentation].",
        {
          sentryPhpDocumentationLink: (
            <ExternalLink href="https://docs.sentry.io/platforms/php/profiling/#installation" />
          ),
        }
      ),
    },
  ];
};

export const getConfigureSnippet = (params: DocsParams): ContentBlock[] => {
  if (!params.isPerformanceSelected && !params.isProfilingSelected) {
    return [];
  }

  return [
    {
      type: 'text',
      text: tct(
        'Add further configuration options to your [code:config/packages/sentry.yaml] file:',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      language: 'yaml',
      code: `when@prod:
      sentry:
          dsn: '%env(SENTRY_DSN)%'${
            params.isPerformanceSelected || params.isProfilingSelected
              ? `
          options:`
              : ''
          }${
            params.isPerformanceSelected
              ? `
              # Specify a fixed sample rate
              traces_sample_rate: 1.0`
              : ''
          }${
            params.isProfilingSelected
              ? `
              # Set a sampling rate for profiling - this is relative to traces_sample_rate
              profiles_sample_rate: 1.0`
              : ''
          }`,
    },
  ];
};
