import {PlatformIcon} from 'platformicons';

import type {BasePlatformOptions} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';
import type {PlatformIntegration} from 'sentry/types/project';

import {
  AGENT_INTEGRATION_ICONS,
  AGENT_INTEGRATION_LABELS,
  BUN_AGENT_INTEGRATIONS,
  DENO_AGENT_INTEGRATIONS,
  DEPLOYMENT_TARGET_ICONS,
  DEPLOYMENT_TARGET_LABELS,
  DeploymentTarget,
  getDefaultAgentIntegration,
  getDeploymentTargets,
  getIntegrationDeploymentTarget,
  getPlatformDeploymentTarget,
  getProjectDeploymentTargets,
  hidesDeploymentTargetSelector,
  NODE_AGENT_INTEGRATIONS,
  PHP_AGENT_INTEGRATIONS,
  PYTHON_AGENT_INTEGRATIONS,
} from './agentIntegrations';

export function useAgentOnboardingOptions({
  platform,
  platformInfo,
}: {
  platform: PlatformKey | null | undefined;
  platformInfo: PlatformIntegration | undefined;
}) {
  const platformId = platform ?? '';
  const isPythonPlatform = platformId.startsWith('python');
  const isDenoPlatform = platformId === 'deno';
  const isBunPlatform = platformId === 'bun';
  const isPhpPlatform = platformId.startsWith('php');
  const isNodePlatform = platformId.startsWith('node');
  const isCloudflarePages = platformId === 'node-cloudflare-pages';
  const projectAgentIntegration = getDefaultAgentIntegration(platform);
  const platformDeploymentTarget = getPlatformDeploymentTarget(platform);
  // Framework projects normally pin both the SDK and the runtime, but some let
  // the user pick the runtime the framework runs on.
  const hasProjectDeploymentTargets = !!getProjectDeploymentTargets(platform);
  const showDeploymentTarget =
    isNodePlatform &&
    !platformDeploymentTarget &&
    !isCloudflarePages &&
    (!projectAgentIntegration || hasProjectDeploymentTargets);

  const integrations = projectAgentIntegration
    ? [projectAgentIntegration]
    : isPythonPlatform
      ? PYTHON_AGENT_INTEGRATIONS
      : isDenoPlatform
        ? DENO_AGENT_INTEGRATIONS
        : isBunPlatform
          ? BUN_AGENT_INTEGRATIONS
          : isPhpPlatform
            ? PHP_AGENT_INTEGRATIONS
            : NODE_AGENT_INTEGRATIONS;

  const platformOptions: BasePlatformOptions = {
    integration: {
      label: t('Integration'),
      items: integrations.map(integration => ({
        label: isPhpPlatform
          ? (platformInfo?.name ?? t('Laravel'))
          : AGENT_INTEGRATION_LABELS[integration],
        value: integration,
        leadingItems: (
          <PlatformIcon
            platform={
              isPhpPlatform
                ? (platform ?? 'php-laravel')
                : AGENT_INTEGRATION_ICONS[integration]
            }
            size={16}
            alt=""
          />
        ),
      })),
    },
    ...(showDeploymentTarget
      ? {
          deploymentTarget: {
            label: t('Deployment'),
            defaultValue: DeploymentTarget.NODE,
            items: getDeploymentTargets(platform).map(target => ({
              label: DEPLOYMENT_TARGET_LABELS[target],
              value: target,
              leadingItems: (
                <PlatformIcon
                  platform={DEPLOYMENT_TARGET_ICONS[target]}
                  size={16}
                  alt=""
                />
              ),
            })),
          },
        }
      : {}),
  };

  const selectedPlatformOptions = useUrlPlatformOptions(platformOptions);
  const integrationDeploymentTarget =
    hasProjectDeploymentTargets || platformDeploymentTarget
      ? undefined
      : getIntegrationDeploymentTarget(selectedPlatformOptions.integration);
  const selectedDeploymentTarget = Object.values(DeploymentTarget).find(
    target => target === selectedPlatformOptions.deploymentTarget
  );
  const deploymentTarget =
    platformDeploymentTarget ?? integrationDeploymentTarget ?? selectedDeploymentTarget;

  // Drop the runtime selector from the options the dropdown renders. The full
  // options above still resolve the selection from the URL.
  const {deploymentTarget: _deploymentTargetOption, ...optionsWithoutDeploymentTarget} =
    platformOptions;
  // Framework projects fix the SDK, so only their runtime selector is rendered.
  const {integration: _integrationOption, ...optionsWithoutIntegration} = platformOptions;

  return {
    deploymentTarget,
    integrationDeploymentTarget,
    isPhpPlatform,
    isPythonPlatform,
    platformOptions: hasProjectDeploymentTargets
      ? optionsWithoutIntegration
      : hidesDeploymentTargetSelector(selectedPlatformOptions.integration)
        ? optionsWithoutDeploymentTarget
        : platformOptions,
    projectAgentIntegration,
    selectedPlatformOptions,
    showPlatformOptions: !projectAgentIntegration || hasProjectDeploymentTargets,
  };
}
