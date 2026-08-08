import {ExternalLink} from '@sentry/scraps/link';

import {copyDsnFieldBlock} from 'sentry/components/onboarding/gettingStartedDoc/copyDsnField';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const onboarding: OnboardingConfig = {
  install: params => [
    {
      title: t('Automatic Configuration (Recommended)'),
      content: [
        {
          type: 'text',
          text: tct(
            'Add Sentry automatically to your app with the [wizardLink:Sentry wizard] (call this inside your project directory).',
            {
              wizardLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/#install" />
              ),
            }
          ),
        },
        {
          type: 'code',
          code: `npx @sentry/wizard@latest -i reactNative ${params.isSelfHosted ? '' : '--saas'} --org ${params.organization.slug} --project ${params.project.slug}`,
          language: 'bash',
        },
        {
          type: 'text',
          text: t(
            'The Sentry wizard will automatically patch your project with the following:'
          ),
        },
        {
          type: 'list',
          items: [
            t('Configure the SDK with your DSN'),
            t('Add source maps upload to your build process'),
            t('Add debug symbols upload to your build process'),
          ],
        },
      ],
    },
    {
      title: t('Configurable Features'),
      content: [
        {
          type: 'text',
          text: tct(
            'In addition to [errorMonitoringLink:error monitoring], here are some of the features you can configure when installing Sentry:',
            {
              errorMonitoringLink: (
                <ExternalLink href="https://docs.sentry.io/product/issues/" />
              ),
            }
          ),
        },
        {
          type: 'list',
          items: [
            tct(
              '[logsLink:Logs]: Send, view, and query logs from your app alongside your errors to get richer context when debugging.',
              {
                logsLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/logs/" />
                ),
              }
            ),
            tct(
              '[tracingLink:Tracing]: Monitor the timing and flow of requests and operations as they happen across different systems in your application to improve performance.',
              {
                tracingLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/tracing/" />
                ),
              }
            ),
            tct(
              '[sessionReplayLink:Session Replay]: Get reproductions of user sessions to improve your app experience.',
              {
                sessionReplayLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/session-replay/" />
                ),
              }
            ),
            tct(
              '[profilingLink:Profiling]: Collect and analyze function-level information about your code to fine-tune performance.',
              {
                profilingLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/profiling/" />
                ),
              }
            ),
            tct(
              '[metricsLink:Application Metrics]: Send, view, and query counters, gauges, and measurements from your app to track health and drill down into related traces, logs, and errors.',
              {
                metricsLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/metrics/" />
                ),
              }
            ),
            tct(
              '[userFeedbackLink:User Feedback]: Collect user feedback from anywhere inside your application at any time, without needing an error event to occur first.',
              {
                userFeedbackLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/user-feedback/" />
                ),
              }
            ),
            tct(
              "[sizeAnalysisLink:Size Analysis]: Monitor your mobile app's size in pre-production to prevent unexpected size increases (regressions) from reaching users.",
              {
                sizeAnalysisLink: (
                  <ExternalLink href="https://docs.sentry.io/platforms/react-native/size-analysis/" />
                ),
              }
            ),
          ],
        },
        {
          type: 'text',
          text: t(
            'Logs, session replay, and user feedback can be added via the wizard. For other features, such as tracing, refer to each documentation page for instructions on getting started.'
          ),
        },
      ],
    },
  ],
  configure: params => [
    {
      title: t('Manual Configuration'),
      collapsible: true,
      content: [
        {
          type: 'text',
          text: tct(
            'Alternatively, you can also set up the SDK manually, by following the [manualSetupLink:manual setup docs].',
            {
              manualSetupLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/react-native/manual-setup/manual-setup/" />
              ),
            }
          ),
        },
        copyDsnFieldBlock(params),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [
    {
      name: t('React Navigation'),
      description: t('Set up automatic instrumentation with React Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-navigation/',
    },
    {
      name: t('React Native Navigation'),
      description: t('Set up automatic instrumentation with React Native Navigation'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/react-native-navigation/',
    },
    {
      name: t('Expo Router'),
      description: t('Set up automatic instrumentation with Expo Router'),
      link: 'https://docs.sentry.io/platforms/react-native/tracing/instrumentation/expo-router/',
    },
  ],
};
