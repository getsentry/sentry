import set from 'lodash/set';

import {t} from 'app/locale';
import {OrganizationSummary, Project} from 'app/types';
import {
  ALL_PROVIDERS,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
  VALUE_MAPPING,
} from 'app/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import ParentLabel from 'app/views/settings/account/notifications/parentLabel';
import {FieldObject} from 'app/views/settings/components/forms/type';

// Which fine-tuning parts are grouped by project
export const isGroupedByProject = (notificationType: string): boolean =>
  ['alerts', 'email', 'workflow'].includes(notificationType);

export const getParentKey = (notificationType: string): string => {
  return isGroupedByProject(notificationType) ? 'project' : 'organization';
};

export const groupByOrganization = (
  projects: Project[]
): Record<string, {organization: OrganizationSummary; projects: Project[]}> => {
  return projects.reduce<
    Record<string, {organization: OrganizationSummary; projects: Project[]}>
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
): NotificationSettingsByProviderObject => {
  /**
   * Transform `data`, a mapping of providers to values, so that all providers
   * in `providerList` are "on" in the resulting object. The "on" value is
   * determined by checking `data` for non-"never" values and falling back to
   * the value `fallbackValue`. The "off" value is either "default" or "never"
   * depending on whether `scopeType` is "parent" or "user" respectively.
   */

  // First pass: determine the fallback value.
  const fallback = Object.values(data).reduce(
    (previousValue, currentValue) =>
      currentValue === 'never' ? previousValue : currentValue,
    fallbackValue
  );
  // Second pass: fill in values for every provider.
  return Object.fromEntries(
    Object.keys(ALL_PROVIDERS).map(provider => [
      provider,
      providerList.includes(provider)
        ? fallback
        : scopeType === 'user'
        ? 'never'
        : 'default',
    ])
  );
};

export const mergeNotificationSettings = (
  ...objects: NotificationSettingsObject[]
): NotificationSettingsObject => {
  /** Deeply merge N notification settings objects (usually just 2). */
  const output = {};
  objects.map(settingsByType =>
    Object.entries(settingsByType).map(([type, settingsByScopeType]) =>
      Object.entries(settingsByScopeType).map(([scopeType, settingsByScopeId]) =>
        Object.entries(settingsByScopeId).map(([scopeId, settingsByProvider]) => {
          set(output, [type, scopeType, scopeId].join('.'), settingsByProvider);
        })
      )
    )
  );

  return output;
};

export const getUserDefaultValues = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): NotificationSettingsByProviderObject => {
  /**
   * Get the mapping of providers to values that describe a user's parent-
   * independent notification preferences. The data from the API uses the user
   * ID rather than "me" so we assume the first ID is the user's.
   */
  return (
    Object.values(notificationSettings[notificationType]?.user || {}).pop() ||
    Object.fromEntries(
      Object.entries(ALL_PROVIDERS).map(([provider, value]) => [
        provider,
        value === 'default' ? getFallBackValue(notificationType) : value,
      ])
    )
  );
};

export const getCurrentProviders = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): string[] => {
  /** Get the list of providers currently active on this page. Note: this can be empty. */
  const userData = getUserDefaultValues(notificationType, notificationSettings);

  return Object.entries(userData)
    .filter(([_, value]) => !['never'].includes(value))
    .map(([provider, _]) => provider);
};

export const getCurrentDefault = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): string => {
  /** Calculate the currently selected provider. */

  const providersList = getCurrentProviders(notificationType, notificationSettings);
  return providersList.length
    ? getUserDefaultValues(notificationType, notificationSettings)[providersList[0]]
    : 'never';
};

export const decideDefault = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): string => {
  /**
   * For a given notificationType, are the parent-independent setting "never"
   * for all providers and are the parent-specific settings "default" or
   * "never". If so, the API is telling us that the user has opted out of
   * all notifications.
   */
  const compare = (a: string, b: string): number => VALUE_MAPPING[a] - VALUE_MAPPING[b];

  const parentIndependentSetting =
    Object.values(getUserDefaultValues(notificationType, notificationSettings))
      .sort(compare)
      .pop() || 'never';

  if (parentIndependentSetting !== 'never') {
    return parentIndependentSetting;
  }

  const parentSpecificSetting =
    Object.values(
      notificationSettings[notificationType]?.[getParentKey(notificationType)] || {}
    )
      .flatMap(settingsByProvider => Object.values(settingsByProvider))
      .sort(compare)
      .pop() || 'default';

  return parentSpecificSetting === 'default' ? 'never' : parentSpecificSetting;
};

export const isEverythingDisabled = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): boolean => {
  /**
   * For a given notificationType, are the parent-independent setting "never"
   * for all providers and are the parent-specific settings "default" or
   * "never"? If so, the API is telling us that the user has opted out of
   * all notifications.
   */
  return ['never', 'default'].includes(
    decideDefault(notificationType, notificationSettings)
  );
};

export const getParentIds = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject
): string[] => {
  /**
   * Extract either the list of project or organization IDs from the
   * notification settings in state. This assumes that the notification settings
   * object is fully backfilled with settings for every parent.
   */
  return Object.keys(
    notificationSettings[notificationType]?.[getParentKey(notificationType)] || {}
  );
};

export const getParentValues = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  parentId: string
): NotificationSettingsByProviderObject => {
  return (
    notificationSettings[notificationType]?.[getParentKey(notificationType)]?.[
      parentId
    ] || {
      email: 'default',
    }
  );
};

export const getParentData = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  parents: OrganizationSummary[] | Project[]
): NotificationSettingsByProviderObject => {
  /** Get a mapping of all parent IDs to the notification setting for the current providers. */
  const provider = getCurrentProviders(notificationType, notificationSettings)[0];

  return Object.fromEntries(
    parents.map(parent => [
      parent.id,
      getParentValues(notificationType, notificationSettings, parent.id)[provider],
    ])
  );
};

export const getStateToPutForProvider = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  changedData: NotificationSettingsByProviderObject
): NotificationSettingsObject => {
  /**
   * I don't need to update the provider for EVERY once of the user's projects
   * and organizations, just the user and parents that have explicit settings.
   */
  const providerList: string[] = changedData.provider.split('+');
  const fallbackValue = getFallBackValue(notificationType);

  let updatedNotificationSettings;
  if (Object.keys(notificationSettings).length) {
    updatedNotificationSettings = {
      [notificationType]: Object.fromEntries(
        Object.entries(notificationSettings[notificationType]).map(
          ([scopeType, scopeTypeData]) => [
            scopeType,
            Object.fromEntries(
              Object.entries(scopeTypeData).map(([scopeId, scopeIdData]) => [
                scopeId,
                backfillMissingProvidersWithFallback(
                  scopeIdData,
                  providerList,
                  fallbackValue,
                  scopeType
                ),
              ])
            ),
          ]
        )
      ),
    };
  } else {
    // If the user has no settings, we need to create them.
    updatedNotificationSettings = {
      [notificationType]: {
        user: {
          me: Object.fromEntries(providerList.map(provider => [provider, fallbackValue])),
        },
      },
    };
  }

  return updatedNotificationSettings;
};

export const getStateToPutForDefault = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  changedData: NotificationSettingsByProviderObject,
  parentIds: string[]
): NotificationSettingsObject => {
  /**
   * Update the current providers' parent-independent notification settings
   * with the new value. If the new value is "never", then also update all
   * parent-specific notification settings to "default". If the previous value
   * was "never", then assume providerList should be "email" only.
   */

  const newValue = Object.values(changedData)[0];
  let providerList = getCurrentProviders(notificationType, notificationSettings);
  if (!providerList.length) {
    providerList = ['email'];
  }

  const updatedNotificationSettings = {
    [notificationType]: {
      user: {
        me: Object.fromEntries(providerList.map(provider => [provider, newValue])),
      },
    },
  };

  if (newValue === 'never') {
    updatedNotificationSettings[notificationType][getParentKey(notificationType)] =
      Object.fromEntries(
        parentIds.map(parentId => [
          parentId,
          Object.fromEntries(providerList.map(provider => [provider, 'default'])),
        ])
      );
  }

  return updatedNotificationSettings;
};

export const getStateToPutForParent = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  changedData: NotificationSettingsByProviderObject,
  parentId: string
): NotificationSettingsObject => {
  /** Get the diff of the Notification Settings for this parent ID. */

  const providerList = getCurrentProviders(notificationType, notificationSettings);
  const newValue = Object.values(changedData)[0];

  return {
    [notificationType]: {
      [getParentKey(notificationType)]: {
        [parentId]: Object.fromEntries(
          providerList.map(provider => [provider, newValue])
        ),
      },
    },
  };
};

export const getParentField = (
  notificationType: string,
  notificationSettings: NotificationSettingsObject,
  parent: OrganizationSummary | Project,
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject
): FieldObject => {
  /** Render each parent and add a default option to the the field choices. */

  const defaultFields = NOTIFICATION_SETTING_FIELDS[notificationType];

  return Object.assign({}, defaultFields, {
    label: <ParentLabel parent={parent} notificationType={notificationType} />,
    getData: data => onChange(data, parent.id),
    name: parent.id,
    choices: defaultFields.choices?.concat([
      [
        'default',
        `${t('Default')} (${getChoiceString(
          defaultFields.choices,
          getCurrentDefault(notificationType, notificationSettings)
        )})`,
      ],
    ]),
    defaultValue: 'default',
    help: undefined,
  }) as any;
};
