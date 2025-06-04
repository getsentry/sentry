import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';

/**
 * Build the Sdk configuration for the getting started docs.
 */
export function buildSdkConfig<P extends DocsParams>({
  params,
  staticParts,
  getIntegrations,
  getDynamicParts,
}: {
  getDynamicParts: (params: P) => string[];
  getIntegrations: (params: P) => string[];
  params: P;
  staticParts: string[];
}) {
  const configurations: string[] = [...staticParts];

  const integrations = getIntegrations(params);
  if (integrations.length > 0) {
    configurations.push(
      `integrations: [\n${integrations.map(integration => integration.trim()).join(',\n')}]`
    );
  }

  const dynamicParts = getDynamicParts(params);
  if (dynamicParts.length > 0) {
    configurations.push(...dynamicParts);
  }

  return configurations.map(configuration => configuration.trim()).join(',\n');
}
