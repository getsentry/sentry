import {PlatformIcon} from 'platformicons';

import type {BasePlatformOptions} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useUrlPlatformOptions} from 'sentry/components/onboarding/platformOptionsControl';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/platform';
import type {PlatformIntegration} from 'sentry/types/project';

import {
  AGENT_INTEGRATION_ICONS,
  AGENT_INTEGRATION_LABELS,
  DENO_AGENT_INTEGRATIONS,
  DEPLOYMENT_TARGET_ICONS,
  DEPLOYMENT_TARGET_LABELS,
  DeploymentTarget,
  getDefaultAgentIntegration,
  getIntegrationDeploymentTarget,
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
  const isPhpPlatform = platformId.startsWith('php');
  const isNodePlatform = platformId.startsWith('node');
  const isCloudflareWorkers = platformId === 'node-cloudflare-workers';
  const isCloudflarePages = platformId === 'node-cloudflare-pages';
  const projectAgentIntegration = getDefaultAgentIntegration(platform);
  const showDeploymentTarget =
    isNodePlatform &&
    !isCloudflareWorkers &&
    !isCloudflarePages &&
    !projectAgentIntegration;

  const integrations = projectAgentIntegration
    ? [projectAgentIntegration]
    : isPythonPlatform
      ? PYTHON_AGENT_INTEGRATIONS
      : isDenoPlatform
        ? DENO_AGENT_INTEGRATIONS
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
            items: [DeploymentTarget.NODE, DeploymentTarget.CLOUDFLARE].map(target => ({
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
  const integrationDeploymentTarget = getIntegrationDeploymentTarget(
    selectedPlatformOptions.integration
  );
  const selectedDeploymentTarget = Object.values(DeploymentTarget).find(
    target => target === selectedPlatformOptions.deploymentTarget
  );
  const deploymentTarget = isCloudflareWorkers
    ? DeploymentTarget.CLOUDFLARE
    : (integrationDeploymentTarget ?? selectedDeploymentTarget);

  return {
    deploymentTarget,
    integrationDeploymentTarget,
    isCloudflareTarget:
      isNodePlatform && deploymentTarget === DeploymentTarget.CLOUDFLARE,
    isPhpPlatform,
    isPythonPlatform,
    platformOptions,
    projectAgentIntegration,
    selectedPlatformOptions,
  };
}
