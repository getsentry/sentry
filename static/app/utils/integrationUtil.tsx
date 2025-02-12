import * as qs from 'query-string';

import type {Result} from 'sentry/components/forms/controls/selectAsyncControl';
import {
  IconAsana,
  IconBitbucket,
  IconCodecov,
  IconGeneric,
  IconGithub,
  IconGitlab,
  IconJira,
  IconSentry,
  IconVsts,
} from 'sentry/icons';
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

import type {IconSize} from './theme';

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
  if (install) {
    return capitalize(install.status) as IntegrationInstallationStatus;
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
  iconSize: IconSize = 'md'
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
    case 'github_enterprise':
      return 'GitHub';
    case 'jira':
    case 'jira_server':
      return 'Jira';
    case 'vsts':
      return 'VSTS';
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
  iconSize: IconSize = 'md'
) {
  switch (provider ?? '') {
    case 'github':
      return <IconGithub size={iconSize} />;
    case 'gitlab':
      return <IconGitlab size={iconSize} />;
    default:
      return <IconSentry size={iconSize} />;
  }
}

// used for project creation and onboarding
// determines what integration maps to what project platform
export const platformToIntegrationMap = {
  'node-awslambda': 'aws_lambda',
  'python-awslambda': 'aws_lambda',
};

export const isSlackIntegrationUpToDate = (integrations: Integration[]): boolean => {
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
