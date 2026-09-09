import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {javascriptMetaFrameworks} from 'sentry/data/platformCategories';
import {
  getInstallStep,
  getManualConfigureStep,
  getMinRequiredVersion,
  MIN_REQUIRED_VERSION,
  agentMonitoring as nodeAgentMonitoring,
} from 'sentry/gettingStartedDocs/node/agentMonitoring';
import {t} from 'sentry/locale';
import {SdkUpdateAlert} from 'sentry/views/insights/pages/agents/components/sdkUpdateAlert';

// Browser SDKs require manual AI spans; meta-frameworks use their server SDK.
export function agentMonitoring({
  packageName = '@sentry/browser',
  clientConfigFileName,
  serverConfigFileName,
}: {
  clientConfigFileName?: string;
  packageName?: `@sentry/${string}`;
  serverConfigFileName?: string;
} = {}): OnboardingConfig {
  return {
    introduction: params => (
      <SdkUpdateAlert
        projectId={params.project.id}
        minVersion={getMinRequiredVersion(params, MIN_REQUIRED_VERSION)}
        packageName={packageName}
      />
    ),
    install: params =>
      getInstallStep(params, {
        packageName,
        minVersion: MIN_REQUIRED_VERSION,
      }),
    configure: params => {
      if (javascriptMetaFrameworks.includes(params.platformKey)) {
        return nodeAgentMonitoring({
          packageName,
          configFileName: serverConfigFileName,
        }).configure(params);
      }

      // v11 browser SDKs no longer export AI instrumentation helpers.
      return getManualConfigureStep(params, {
        packageName,
        importMode: 'esm-only',
        configFileName: clientConfigFileName,
        docUrl:
          'https://docs.sentry.io/platforms/javascript/tracing/instrumentation/ai-agents-module-browser/#manual-span-creation',
      });
    },
    verify: params => {
      if (javascriptMetaFrameworks.includes(params.platformKey)) {
        return nodeAgentMonitoring({
          packageName,
          configFileName: serverConfigFileName,
        }).verify(params);
      }

      return [
        {
          type: StepType.VERIFY,
          content: [
            {
              type: 'text',
              text: t(
                'Verify that your instrumentation works by simply calling your LLM.'
              ),
            },
          ],
        },
      ];
    },
  };
}
