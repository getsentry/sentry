import set from 'lodash/set';

import {Organization, Project} from 'app/types';

export type NotificationSettingsObject = {
  [key: string]: {[key: string]: {[key: string]: {[key: string]: string}}};
};

// Which fine tuning parts are grouped by project
export const isGroupedByProject = (type: string): boolean =>
  ['alerts', 'email', 'workflow'].includes(type);

export const groupByOrganization = (projects: Project[]) => {
  return projects.reduce<
    Record<string, {organization: Organization; projects: Project[]}>
  >((acc, project) => {
    const orgSlug = project.organization.slug;
    if (acc.hasOwnProperty(orgSlug)) {
      acc[orgSlug].projects.push(project);
    } else {
      acc[orgSlug] = {
        organization: project.organization,
        projects: [project],
      };
    }
    return acc;
  }, {});
};

export const getFallBackValue = (notificationType: string): string => {
  switch (notificationType) {
    case 'alerts':
      return 'always';
    case 'deploy':
      return 'committed_only';
    case 'workflow':
      return 'subscribe_only';
    default:
      return '';
  }
};

export const providerListToString = (providers: string[]): string => {
  return providers.sort().join('+');
};

export const getChoiceString = (choices: string[][], key: string): string => {
  if (!choices) {
    return 'default';
  }
  const found = choices.find(row => row[0] === key);
  if (!found) {
    throw new Error(`Could not find ${key}`);
  }

  return found[1];
};

export const backfillMissingProvidersWithFallback = (
  data: {[key: string]: string},
  providerList: string[],
  fallbackValue: string,
  scopeType: string
): {[key: string]: string} => {
  /**
   * Transform `data` to include only providers expected in `providerList`.
   * Everything not in that list is set to "never". Missing values will be
   * backfilled either with a current value from `data` or `fallbackValue` if
   * none are present. When wiping out a provider, set the parent-independent
   * setting to "never" and all parent-specific settings to "default".
   *
   * For example:
   * f({}, ["email"], "sometimes", "user") = {"email": "sometimes"}
   *
   * f({"email": "always", pagerduty: "always"}, ["email", "slack"], "sometimes", "user) =
   * {"email": "always", "slack": "always", "pagerduty": "never"}
   */
  const entries: string[][] = [];
  let fallback = fallbackValue;
  for (const [provider, previousValue] of Object.entries(data)) {
    fallback = previousValue;
    let value;
    if (providerList.includes(provider)) {
      value = previousValue;
    } else if (scopeType === 'user') {
      value = 'never';
    } else {
      value = 'default';
    }

    entries.push([provider, value]);
  }

  for (const provider of providerList) {
    entries.push([provider, fallback]);
  }
  return Object.fromEntries(entries);
};

export const mergeNotificationSettings = (
  ...objects: NotificationSettingsObject[]
): NotificationSettingsObject => {
  /** Deeply merge N notification settings objects (usually just 2). */
  const output = {};
  objects.map(settingsByType =>
    Object.entries(settingsByType).map(([type, settingsByScopeType]) =>
      Object.entries(settingsByScopeType).map(([scopeType, settingsByScopeId]) =>
        Object.entries(settingsByScopeId).map(([scopeId, settingsByProvider]) =>
          Object.entries(settingsByProvider).map(([provider, value]) => {
            set(output, [type, scopeType, scopeId, provider].join('.'), value);
          })
        )
      )
    )
  );

  return output;
};
