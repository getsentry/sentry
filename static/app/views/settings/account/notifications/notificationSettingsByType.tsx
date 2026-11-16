import {Fragment, useEffect} from 'react';
import {
  useQuery,
  mutationOptions,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {z} from 'zod';
import {useStore} from 'zustand';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {toast} from '@sentry/scraps/toast';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {TextBlock} from 'sentry/views/settings/components/text/textBlock';

import type {
  DefaultSettings,
  NotificationOptionsObject,
  NotificationProvidersObject,
  NotificationSettingsType,
  SupportedProviders,
} from './constants';
import {SUPPORTED_PROVIDERS} from './constants';
import {
  ACCOUNT_NOTIFICATION_FIELDS,
  NOTIFICATION_SETTING_FIELDS,
  QUOTA_FIELDS,
} from './fields';
import {NotificationSettingsByEntity} from './notificationSettingsByEntity';
import type {Identity} from './types';
import {UnlinkedAlert} from './unlinkedAlert';
import {isGroupedByProject} from './utils';
import {WeeklyReportProjectExclusions} from './weeklyReportProjectExclusions';

type Props = {
  notificationType: string; // TODO(steve)? type better
};

const typeMappedChildren: Record<string, string[]> = {
  quota: QUOTA_FIELDS.map(field => field.name),
};

// Ideally, we could just use SUPPORTED_PROVIDERS here, but 'msteams' is not widely tested.
const ALLOWED_PROVIDERS = new Set(SUPPORTED_PROVIDERS.filter(p => p.includes('slack')));

const getQueryParams = (notificationType: string) => {
  // if we need multiple settings on this page
  // then omit the type so we can load all settings
  if (notificationType in typeMappedChildren) {
    return {};
  }
  return {type: notificationType};
};

/**
 * Converts legacy tuple choices `[value, label]` to options `{value, label}` for Select.
 */
function choicesToOptions(
  choices: ReadonlyArray<readonly [string, string]>
): Array<{label: string; value: string}> {
  return choices.map(([value, label]) => ({value, label}));
}

function DefaultNotificationField({
  initialValue,
  notificationType,
  fieldMutationOptions,
}: {
  fieldMutationOptions: UseMutationOptions<
    NotificationOptionsObject,
    Error,
    Record<string, string>
  >;
  initialValue: string;
  notificationType: string;
}) {
  const fieldDef =
    NOTIFICATION_SETTING_FIELDS[notificationType as NotificationSettingsType];

  const choices = fieldDef.choices;
  const help =
    notificationType === 'spikeProtection'
      ? t('This is the default for all projects under all organizations.')
      : isGroupedByProject(notificationType)
        ? t('This is the default for all projects.')
        : t('This is the default for all organizations.');
  const label = fieldDef.label;
  const name = notificationType;

  if (!choices) {
    return null;
  }
  const schema = z.object({[name]: z.string()});

  return (
    <AutoSaveForm
      name={name}
      schema={schema}
      initialValue={initialValue}
      mutationOptions={fieldMutationOptions}
    >
      {field => (
        <field.Layout.Row label={label} hintText={help}>
          <field.Select
            value={field.state.value}
            onChange={field.handleChange}
            options={choicesToOptions(choices)}
          />
        </field.Layout.Row>
      )}
    </AutoSaveForm>
  );
}

export function NotificationSettingsByType({notificationType}: Props) {
  const organizations = useStore(OrganizationsStore, state => state.organizations);
  const queryClient = useQueryClient();
  const notificationOptions = apiOptions.as<NotificationOptionsObject[]>()(
    '/users/$userId/notification-options/',
    {path: {userId: 'me'}, query: getQueryParams(notificationType), staleTime: 30_000}
  );
  const providerOptions = apiOptions.as<NotificationProvidersObject[]>()(
    '/users/$userId/notification-providers/',
    {path: {userId: 'me'}, query: getQueryParams(notificationType), staleTime: 30_000}
  );
  const {data: notificationOptionData = [], status: notificationOptionStatus} =
    useQuery(notificationOptions);
  const {data: notificationProviders = [], status: notificationProviderStatus} =
    useQuery(providerOptions);
  const {data: allIdentities = [], status: identitiesStatus} = useQuery(
    apiOptions.as<Identity[]>()('/users/$userId/identities/', {
      path: {userId: 'me'},
      staleTime: 30_000,
    })
  );
  const identities = allIdentities.filter(identity =>
    ALLOWED_PROVIDERS.has(identity?.identityProvider?.type as SupportedProviders)
  );

  const {data: allOrgIntegrations = [], status: organizationIntegrationStatus} = useQuery(
    apiOptions.as<Array<OrganizationIntegration | null>>()(
      '/users/$userId/organization-integrations/',
      {path: {userId: 'me'}, query: {provider: [...ALLOWED_PROVIDERS]}, staleTime: 30_000}
    )
  );
  const organizationIntegrations = allOrgIntegrations.filter(
    (orgIntegration): orgIntegration is OrganizationIntegration =>
      ALLOWED_PROVIDERS.has(orgIntegration?.provider.key as SupportedProviders)
  );
  const {data: defaultSettings, status: defaultSettingsStatus} = useQuery(
    apiOptions.as<DefaultSettings>()('/notification-defaults/', {staleTime: 30_000})
  );

  useEffect(() => {
    trackAnalytics('notification_settings.tuning_page_viewed', {
      organization: null,
      notification_type: notificationType,
    });
  }, [notificationType]);

  const trackTuningUpdated = (tuningFieldType: string) => {
    trackAnalytics('notification_settings.updated_tuning_setting', {
      organization: null,
      notification_type: notificationType,
      tuning_field_type: tuningFieldType,
    });
  };

  const getInitialTopOptionData = (): Record<string, string> => {
    const matchedOption = notificationOptionData.find(
      option => option.type === notificationType && option.scopeType === 'user'
    );
    // if no match, fall back to the
    let defaultValue: string;
    if (matchedOption) {
      defaultValue = matchedOption.value;
    } else {
      if (defaultSettings) {
        defaultValue = defaultSettings.typeDefaults[notificationType]!;
      } else {
        // should never happen
        defaultValue = 'never';
      }
    }
    // if we have child types, map the default
    const childTypes = typeMappedChildren[notificationType] || [];
    const childTypesDefaults = Object.fromEntries(
      childTypes.map(childType => {
        const childMatchedOption = notificationOptionData.find(
          option => option.type === childType && option.scopeType === 'user'
        );
        return [childType, childMatchedOption ? childMatchedOption.value : defaultValue];
      })
    );

    return {
      [notificationType]: defaultValue,
      ...childTypesDefaults,
    };
  };

  const getLinkedOrgs = (provider: SupportedProviders): OrganizationSummary[] => {
    const integrationExternalIDsByOrganizationID = Object.fromEntries(
      organizationIntegrations
        .filter(
          organizationIntegration => organizationIntegration.provider.key === provider
        )
        .map(organizationIntegration => [
          organizationIntegration.organizationId,
          organizationIntegration.externalId,
        ])
    );

    const identitiesByExternalId = Object.fromEntries(
      identities.map(identity => [identity?.identityProvider?.externalId, identity])
    );

    return organizations.filter(organization => {
      const externalID = integrationExternalIDsByOrganizationID[organization.id]!;
      const identity = identitiesByExternalId[externalID];
      return !!identity;
    });
  };

  const getUnlinkedOrgs = (provider: SupportedProviders): OrganizationSummary[] => {
    const linkedOrgs = getLinkedOrgs(provider);
    return organizations.filter(organization => !linkedOrgs.includes(organization));
  };

  const isProviderSupported = (provider: SupportedProviders) => {
    // email is always possible
    if (provider === 'email') {
      return true;
    }
    return getLinkedOrgs(provider).length > 0;
  };

  const getProviders = (): SupportedProviders[] => {
    const relevantProviderSettings = notificationProviders.filter(
      option => option.scopeType === 'user' && option.type === notificationType
    );

    return SUPPORTED_PROVIDERS.filter(isProviderSupported).filter(provider => {
      const providerSetting = relevantProviderSettings.find(
        option => option.provider === provider
      );
      // if there is a matched setting use that, otherwise check provider defaults
      return providerSetting
        ? providerSetting.value === 'always'
        : defaultSettings?.providerDefaults.includes(provider);
    });
  };

  const removeNotificationMutation = useMutation({
    mutationFn: (id: string) =>
      fetchMutation({
        method: 'DELETE',
        url: getApiUrl('/users/$userId/notification-options/$notificationOptionId/', {
          path: {userId: 'me', notificationOptionId: id},
        }),
      }),
    onSuccess: (_, id) => {
      queryClient.setQueryData(notificationOptions.queryKey, response =>
        response?.json
          ? {
              ...response,
              json: response.json.filter(
                option => option.id.toString() !== id.toString()
              ),
            }
          : response
      );
    },
  });

  const addNotificationMutation = useMutation({
    mutationFn: (data: Omit<NotificationOptionsObject, 'id'>) =>
      fetchMutation<NotificationOptionsObject>({
        method: 'PUT',
        url: getApiUrl('/users/$userId/notification-options/', {path: {userId: 'me'}}),
        options: {},
        data,
      }),
    onSuccess: notificationOption => {
      queryClient.setQueryData(notificationOptions.queryKey, response => ({
        ...response,
        headers: response?.headers ?? {},
        json: [...(response?.json ?? []), notificationOption],
      }));
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (data: NotificationOptionsObject) =>
      fetchMutation<NotificationOptionsObject>({
        method: 'PUT',
        url: getApiUrl('/users/$userId/notification-options/', {path: {userId: 'me'}}),
        options: {},
        data,
      }),
    onSuccess: notificationOption => {
      // Replace the item in state
      queryClient.setQueryData(notificationOptions.queryKey, response =>
        response?.json
          ? {
              ...response,
              json: response.json.map(option =>
                option.id === notificationOption.id ? notificationOption : option
              ),
            }
          : response
      );
      toast.success(t('Updated notification setting'));
    },
    onError: () => {
      toast.error(t('Unable to update notification setting'));
    },
  });

  const unlinkedSlackOrgs = getUnlinkedOrgs('slack');
  const unlinkedSlackStagingOrgs = getUnlinkedOrgs('slack_staging');
  const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType]!;

  const entityType = isGroupedByProject(notificationType) ? 'project' : 'organization';

  if (notificationType === 'quota' && ConfigStore.get('isSelfHosted')) {
    return null;
  }

  if (
    notificationOptionStatus === 'pending' ||
    notificationProviderStatus === 'pending' ||
    identitiesStatus === 'pending' ||
    organizationIntegrationStatus === 'pending' ||
    defaultSettingsStatus === 'pending'
  ) {
    return <LoadingIndicator />;
  }

  const initialTopOptionData = getInitialTopOptionData();
  const initialProviders = getProviders();

  const optionMutationOptions = (fieldName: string) =>
    mutationOptions({
      mutationFn: (data: Record<string, string>) =>
        fetchMutation<NotificationOptionsObject>({
          method: 'PUT',
          url: getApiUrl('/users/$userId/notification-options/', {
            path: {userId: 'me'},
          }),
          data: {
            type: fieldName,
            scopeType: 'user',
            scopeIdentifier: ConfigStore.get('user').id,
            value: data[fieldName],
          },
        }),
      onSuccess: notificationOption => {
        trackTuningUpdated('general');
        queryClient.setQueryData(notificationOptions.queryKey, response => {
          const existing = response?.json ?? [];
          const json = existing.some(opt => opt.id === notificationOption.id)
            ? existing.map(opt =>
                opt.id === notificationOption.id ? notificationOption : opt
              )
            : [...existing, notificationOption];
          return {...response, headers: response?.headers ?? {}, json};
        });
      },
    });

  const providerChoices = (
    NOTIFICATION_SETTING_FIELDS.provider.choices as Array<[SupportedProviders, string]>
  )
    .filter(([providerSlug]) => isProviderSupported(providerSlug))
    .map(([value, label]) => ({value, label}));

  const providerSchema = z.object({provider: z.array(z.string()).min(1)});

  const providerMutationOptions = mutationOptions({
    mutationFn: (data: {provider: string[]}) =>
      fetchMutation({
        method: 'PUT',
        url: getApiUrl('/users/$userId/notification-providers/', {
          path: {userId: 'me'},
        }),
        data: {
          type: notificationType,
          scopeType: 'user',
          scopeIdentifier: ConfigStore.get('user').id,
          providers: data.provider,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: providerOptions.queryKey,
      });
    },
  });

  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <SettingsPageHeader title={title} />
      {description && <TextBlock>{description}</TextBlock>}
      {notificationType !== 'reports' && (
        <FieldGroup
          title={
            isGroupedByProject(notificationType)
              ? t('All Projects')
              : t('All Organizations')
          }
        >
          {notificationType === 'quota' ? (
            QUOTA_FIELDS.map(field => {
              const schema = z.object({[field.name]: z.string()});
              return (
                <AutoSaveForm
                  key={field.name}
                  name={field.name}
                  schema={schema}
                  initialValue={initialTopOptionData[field.name] ?? 'always'}
                  mutationOptions={optionMutationOptions(field.name)}
                >
                  {fieldApi => (
                    <fieldApi.Layout.Row label={field.label} hintText={field.help}>
                      <fieldApi.Select
                        value={fieldApi.state.value}
                        onChange={fieldApi.handleChange}
                        options={choicesToOptions(field.choices)}
                      />
                    </fieldApi.Layout.Row>
                  )}
                </AutoSaveForm>
              );
            })
          ) : (
            <DefaultNotificationField
              notificationType={notificationType}
              initialValue={initialTopOptionData[notificationType] ?? 'always'}
              fieldMutationOptions={optionMutationOptions(notificationType)}
            />
          )}
        </FieldGroup>
      )}
      {notificationType !== 'reports' && notificationType !== 'brokenMonitors' ? (
        <FieldGroup title={t('Delivery Method')}>
          <AutoSaveForm
            name="provider"
            schema={providerSchema}
            initialValue={initialProviders}
            mutationOptions={providerMutationOptions}
          >
            {field => (
              <Fragment>
                {(field.state.value ?? initialProviders).includes('slack') &&
                unlinkedSlackOrgs.length > 0 ? (
                  <UnlinkedAlert organizations={unlinkedSlackOrgs} />
                ) : null}
                {(field.state.value ?? initialProviders).includes('slack_staging') &&
                unlinkedSlackStagingOrgs.length > 0 ? (
                  <UnlinkedAlert organizations={unlinkedSlackStagingOrgs} />
                ) : null}
                <field.Layout.Row
                  label={t('Delivery Method')}
                  hintText={t('Where personal notifications will be sent.')}
                >
                  <field.Select
                    multiple
                    value={field.state.value}
                    onChange={field.handleChange}
                    options={providerChoices}
                  />
                </field.Layout.Row>
              </Fragment>
            )}
          </AutoSaveForm>
        </FieldGroup>
      ) : null}
      {notificationType === 'reports' ? (
        <WeeklyReportProjectExclusions
          organizations={organizations}
          notificationOptions={notificationOptionData}
          handleRemoveNotificationOption={id => removeNotificationMutation.mutate(id)}
          handleAddNotificationOption={option => addNotificationMutation.mutate(option)}
          handleEditNotificationOption={option =>
            deleteNotificationMutation.mutate(option)
          }
        />
      ) : (
        <NotificationSettingsByEntity
          notificationType={notificationType}
          notificationOptions={notificationOptionData}
          organizations={organizations}
          handleRemoveNotificationOption={id => removeNotificationMutation.mutate(id)}
          handleAddNotificationOption={option => addNotificationMutation.mutate(option)}
          handleEditNotificationOption={option =>
            deleteNotificationMutation.mutate(option)
          }
          entityType={entityType}
        />
      )}
    </Fragment>
  );
}
