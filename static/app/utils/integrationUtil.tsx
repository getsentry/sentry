import * as qs from 'query-string';

import type {Result} from 'sentry/components/core/select/async';
import {
  IconAsana,
  IconBitbucket,
  IconCodecov,
  IconGeneric,
  IconGithub,
  IconGitlab,
  IconJira,
  IconPerforce,
  IconSentry,
  IconVsts,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import type {Hooks} from 'sentry/types/hooks';
import type {
  AppOrProviderOrPlugin,
  CodeOwner,
  DocIntegration,
  ExternalActorMapping,
  ExternalActorMappingOrSuggestion,
  Integration,
  IntegrationFeature,
  IntegrationInstallationStatus,
  IntegrationType,
  PluginWithProjectList,
  SentryApp,
  SentryAppInstallation,
} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import {capitalize} from 'sentry/utils/string/capitalize';
import {POPULARITY_WEIGHT} from 'sentry/views/settings/organizationIntegrations/constants';

/**
 * TODO: remove alias once all usages are updated
 * @deprecated Use trackAnalytics instead
 */
export const trackIntegrationAnalytics = trackAnalytics;

/**
 * In sentry.io the features list supports rendering plan details. If the hook
 * is not registered for rendering the features list like this simply show the
 * features as a normal list.
 */
const generateFeaturesList = (p: any) => (
  <ul>
    {p.features.map((f: any, i: any) => (
      <li key={i}>{f.description}</li>
    ))}
  </ul>
);

const generateIntegrationFeatures = (p: any) =>
  p.children({
    disabled: false,
    disabledReason: null,
    ungatedFeatures: p.features,
    gatedFeatureGroups: [],
  });

const defaultFeatureGateComponents: ReturnType<Hooks['integrations:feature-gates']> = {
  IntegrationFeatures: generateIntegrationFeatures,
  FeatureList: generateFeaturesList,
};

export const getIntegrationFeatureGate = () => {
  const defaultHook = () => defaultFeatureGateComponents;
  const featureHook = HookStore.get('integrations:feature-gates')[0] || defaultHook;
  return featureHook();
};

export const getSentryAppInstallStatus = (install: SentryAppInstallation | undefined) => {
  if (install && install.status !== 'pending_deletion') {
    return capitalize(install.status) as IntegrationInstallationStatus;
  }
  if (install && install.status === 'pending_deletion') {
    return 'Pending Deletion';
  }
  return 'Not Installed';
};

export const getCategories = (features: IntegrationFeature[]): string[] => {
  const transform = features.map(({featureGate}) => {
    const feature = featureGate
      .replace(/integrations/g, '')
      .replace(/-/g, ' ')
      .trim();
    switch (feature) {
      case 'actionable notification':
        return 'notification action';
      case 'issue basic':
      case 'issue link':
      case 'issue sync':
      case 'project management':
        return 'issue tracking';
      case 'commits':
        return 'source code management';
      case 'chat unfurl':
        return 'chat';
      default:
        return feature;
    }
  });

  return [...new Set(transform)];
};

export const getCategoriesForIntegration = (
  integration: AppOrProviderOrPlugin
): string[] => {
  if (isSentryApp(integration)) {
    return ['internal', 'unpublished'].includes(integration.status)
      ? [integration.status]
      : getCategories(integration.featureData);
  }
  if (isPlugin(integration)) {
    return getCategories(integration.featureDescriptions);
  }
  if (isDocIntegration(integration)) {
    return getCategories(integration.features ?? []);
  }
  return getCategories(integration.metadata.features);
};

export function isSentryApp(
  integration: AppOrProviderOrPlugin
): integration is SentryApp {
  return !!(integration as SentryApp).uuid;
}

export function isPlugin(
  integration: AppOrProviderOrPlugin
): integration is PluginWithProjectList {
  return integration.hasOwnProperty('shortName');
}

export function isDocIntegration(
  integration: AppOrProviderOrPlugin
): integration is DocIntegration {
  return integration.hasOwnProperty('isDraft');
}

export function isExternalActorMapping(
  mapping: ExternalActorMappingOrSuggestion
): mapping is ExternalActorMapping {
  return mapping.hasOwnProperty('id');
}

export const getIntegrationType = (
  integration: AppOrProviderOrPlugin
): IntegrationType => {
  if (isSentryApp(integration)) {
    return 'sentry_app';
  }
  if (isPlugin(integration)) {
    return 'plugin';
  }
  if (isDocIntegration(integration)) {
    return 'document';
  }
  return 'first_party';
};

export const convertIntegrationTypeToSnakeCase = (
  type: 'plugin' | 'firstParty' | 'sentryApp' | 'docIntegration'
) => {
  switch (type) {
    case 'firstParty':
      return 'first_party';
    case 'sentryApp':
      return 'sentry_app';
    case 'docIntegration':
      return 'document';
    default:
      return type;
  }
};

export const safeGetQsParam = (param: string) => {
  try {
    const query = qs.parse(window.location.search) || {};
    return query[param];
  } catch {
    return undefined;
  }
};

export const getIntegrationIcon = (
  integrationType?: string,
  iconSize: SVGIconProps['size'] = 'md'
) => {
  switch (integrationType) {
    case 'asana':
      return <IconAsana size={iconSize} />;
    case 'bitbucket':
      return <IconBitbucket size={iconSize} />;
    case 'gitlab':
      return <IconGitlab size={iconSize} />;
    case 'github':
    case 'github_enterprise':
      return <IconGithub size={iconSize} />;
    case 'jira':
    case 'jira_server':
      return <IconJira size={iconSize} />;
    case 'perforce':
      return <IconPerforce size={iconSize} />;
    case 'vsts':
      return <IconVsts size={iconSize} />;
    case 'codecov':
      return <IconCodecov size={iconSize} />;
    default:
      return <IconGeneric size={iconSize} />;
  }
};

export const getIntegrationDisplayName = (integrationType?: string) => {
  switch (integrationType) {
    case 'asana':
      return 'Asana';
    case 'bitbucket':
      return 'Bitbucket';
    case 'gitlab':
      return 'GitLab';
    case 'github':
      return 'GitHub';
    case 'github_enterprise':
      return 'GitHub Enterprise';
    case 'jira':
    case 'jira_server':
      return 'Jira';
    case 'perforce':
      return 'Perforce';
    case 'vsts':
      return 'Azure DevOps';
    case 'codecov':
      return 'Codeov';
    default:
      return '';
  }
};

export const getIntegrationSourceUrl = (
  integrationType: string,
  sourceUrl: string,
  lineNo: number | null
) => {
  switch (integrationType) {
    case 'bitbucket':
    case 'bitbucket_server':
      return `${sourceUrl}#lines-${lineNo}`;
    case 'vsts': {
      const url = new URL(sourceUrl);
      if (lineNo) {
        url.searchParams.set('line', lineNo.toString());
        url.searchParams.set('lineEnd', (lineNo + 1).toString());
        url.searchParams.set('lineStartColumn', '1');
        url.searchParams.set('lineEndColumn', '1');
        url.searchParams.set('lineStyle', 'plain');
        url.searchParams.set('_a', 'contents');
      }
      return url.toString();
    }
    case 'github':
    case 'github_enterprise':
    default:
      if (lineNo === null) {
        return sourceUrl;
      }
      return `${sourceUrl}#L${lineNo}`;
  }
};

export function getCodeOwnerIcon(
  provider: CodeOwner['provider'],
  iconSize: SVGIconProps['size'] = 'md'
) {
  switch (provider ?? '') {
    case 'github':
      return <IconGithub size={iconSize} />;
    case 'gitlab':
      return <IconGitlab size={iconSize} />;
    case 'perforce':
      return <IconPerforce size={iconSize} />;
    default:
      return <IconSentry size={iconSize} />;
  }
}
const isSlackIntegrationUpToDate = (integrations: Integration[]): boolean => {
  return integrations.every(
    integration =>
      integration.provider.key !== 'slack' || integration.scopes?.includes('commands')
  );
};

export const getAlertText = (integrations?: Integration[]): string | undefined => {
  return isSlackIntegrationUpToDate(integrations || [])
    ? undefined
    : t(
        'Update to the latest version of our Slack app to get access to personal and team notifications.'
      );
};

/**
 * Uses the mapping and baseEndpoint to derive the details for the mappings request.
 * @param baseEndpoint Must have a trailing slash, since the id is appended for PUT requests!
 * @param mapping The mapping or suggestion being sent to the endpoint
 * @returns An object containing the request method (apiMethod), and final endpoint (apiEndpoint)
 */
export const getExternalActorEndpointDetails = (
  baseEndpoint: string,
  mapping?: ExternalActorMappingOrSuggestion
): {apiEndpoint: string; apiMethod: 'POST' | 'PUT'} => {
  const isValidMapping = mapping && isExternalActorMapping(mapping);
  return {
    apiMethod: isValidMapping ? 'PUT' : 'POST',
    apiEndpoint: isValidMapping ? `${baseEndpoint}${mapping.id}/` : baseEndpoint,
  };
};

export const sentryNameToOption = ({id, name}: any): Result => ({
  value: id,
  label: name,
});

export function getIntegrationStatus(integration: Integration) {
  // there are multiple status fields for an integration we consider
  const statusList = [integration.organizationIntegrationStatus, integration.status];
  const firstNotActive = statusList.find(s => s !== 'active');
  // Active if everything is active, otherwise the first inactive status
  return firstNotActive ?? 'active';
}

/**
 * Returns a prioritized status across all integrations for a provider
 */
export function getProviderIntegrationStatus(integrations: Integration[]) {
  const statusList = integrations.map(getIntegrationStatus);
  if (statusList.includes('active')) {
    return 'Installed';
  }
  if (statusList.includes('disabled')) {
    return 'Disabled';
  }
  if (statusList.includes('pending_deletion')) {
    return 'Pending Deletion';
  }
  return 'Not Installed';
}

/**
 * Returns 0 if uninstalled, 1 if pending, 2 if installed
 */
function getInstallValue({
  integration,
  integrationInstalls,
  sentryAppInstalls,
}: {
  integration: AppOrProviderOrPlugin;
  integrationInstalls: Integration[];
  sentryAppInstalls: SentryAppInstallation[];
}) {
  if (isPlugin(integration)) {
    return integration.projectList.length > 0 ? 2 : 0;
  }

  if (isSentryApp(integration)) {
    const install = sentryAppInstalls.find(sa => sa.app.slug === integration.slug);
    if (install) {
      return install.status === 'pending' ? 1 : 2;
    }
    return 0;
  }

  if (isDocIntegration(integration)) {
    return 0;
  }

  return integrationInstalls.some(i => i.provider.key === integration.key) ? 2 : 0;
}

function getPopularityWeight(integration: AppOrProviderOrPlugin) {
  if (isSentryApp(integration) || isDocIntegration(integration)) {
    return integration?.popularity ?? 1;
  }
  return POPULARITY_WEIGHT[integration.slug] ?? 1;
}

export function sortIntegrations({
  list,
  sentryAppInstalls,
  integrationInstalls,
}: {
  integrationInstalls: Integration[];
  list: AppOrProviderOrPlugin[];
  sentryAppInstalls: SentryAppInstallation[];
}) {
  return list.toSorted((a: AppOrProviderOrPlugin, b: AppOrProviderOrPlugin) => {
    // sort by whether installed first
    const diffWeight =
      getInstallValue({
        integration: b,
        integrationInstalls,
        sentryAppInstalls,
      }) -
      getInstallValue({
        integration: a,
        integrationInstalls,
        sentryAppInstalls,
      });
    if (diffWeight !== 0) {
      return diffWeight;
    }
    // then sort by popularity
    const diffPop = getPopularityWeight(b) - getPopularityWeight(a);
    if (diffPop !== 0) {
      return diffPop;
    }
    // then sort by name
    return a.slug.localeCompare(b.slug);
  });
}
