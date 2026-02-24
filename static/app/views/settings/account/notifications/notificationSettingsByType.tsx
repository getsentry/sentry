import {Fragment, useEffect} from 'react';
import {mutationOptions, useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveField, FieldGroup} from '@sentry/scraps/form';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, setApiQueryData, useApiQuery} from 'sentry/utils/queryClient';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

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
  SPEND_FIELDS,
} from './fields';
import NotificationSettingsByEntity from './notificationSettingsByEntity';
import type {Identity} from './types';
import UnlinkedAlert from './unlinkedAlert';
import {isGroupedByProject} from './utils';

type Props = {
  notificationType: string; // TODO(steve)? type better
};

const typeMappedChildren: Record<string, string[]> = {
  quota: QUOTA_FIELDS.map(field => field.name),
};

const getQueryParams = (notificationType: string) => {
  // if we need multiple settings on this page
  // then omit the type so we can load all settings
  if (notificationType in typeMappedChildren) {
    return {};
  }
  return {type: notificationType};
};

const notificationOptionsQueryKey = (notificationType: string) =>
  [
    getApiUrl('/users/$userId/notification-options/', {path: {userId: 'me'}}),
    {query: getQueryParams(notificationType)},
  ] as const;

/**
 * Converts legacy tuple choices `[value, label]` to options `{value, label}` for Select.
 */
function choicesToOptions(
  choices: ReadonlyArray<readonly [string, string]>
): Array<{label: string; value: string}> {
  return choices.map(([value, label]) => ({value, label}));
}

export function NotificationSettingsByType({notificationType}: Props) {
  const {organizations} = useLegacyStore(OrganizationsStore);
  const queryClient = useQueryClient();
  const {data: notificationOptions = [], status: notificationOptionStatus} = useApiQuery<
    NotificationOptionsObject[]
  >(notificationOptionsQueryKey(notificationType), {
    staleTime: 30_000,
  });
  const {data: notificationProviders = [], status: notificationProviderStatus} =
    useApiQuery<NotificationProvidersObject[]>(
      [
        getApiUrl('/users/$userId/notification-providers/', {path: {userId: 'me'}}),
        {query: getQueryParams(notificationType)},
      ],
      {staleTime: 30_000}
    );
  const {data: identities = [], status: identitiesStatus} = useApiQuery<Identity[]>(
    [
      getApiUrl('/users/$userId/identities/', {path: {userId: 'me'}}),
      {query: {provider: 'slack'}},
    ],
    {staleTime: 30_000}
  );
  const {data: organizationIntegrations = [], status: organizationIntegrationStatus} =
    useApiQuery<OrganizationIntegration[]>(
      [
        getApiUrl('/users/$userId/organization-integrations/', {path: {userId: 'me'}}),
        {query: {provider: 'slack'}},
      ],
      {staleTime: 30_000}
    );
  const {data: defaultSettings, status: defaultSettingsStatus} =
    useApiQuery<DefaultSettings>([getApiUrl('/notification-defaults/')], {
      staleTime: 30_000,
    });

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
    const matchedOption = notificationOptions.find(
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
    const childTypes: string[] = typeMappedChildren[notificationType] || [];
    const childTypesDefaults = Object.fromEntries(
      childTypes.map(childType => {
        const childMatchedOption = notificationOptions.find(
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

  const filterCategoryFields = (
    fields: Array<{
      choices: ReadonlyArray<readonly [string, string]>;
      name: string;
      help?: React.ReactNode;
      label?: React.ReactNode;
    }>
  ) => {
    // at least one org exists with am3 tiered plan
    const hasOrgWithAm3 = organizations.some(organization =>
      organization.features?.includes('am3-tier')
    );

    // at least one org exists without am3 tier plan
    const hasOrgWithoutAm3 = organizations.some(
      organization => !organization.features?.includes('am3-tier')
    );

    // at least one org exists with am2 tier plan
    const hasOrgWithAm2 = organizations.some(organization =>
      organization.features?.includes('am2-tier')
    );

    // Check if any organization has the continuous-profiling-billing feature flag
    const hasOrgWithContinuousProfilingBilling = organizations.some(organization =>
      organization.features?.includes('continuous-profiling-billing')
    );

    const hasSeerBilling = organizations.some(organization =>
      organization.features?.includes('seer-billing')
    );

    const hasLogsBilling = organizations.some(organization =>
      organization.features?.includes('logs-billing')
    );

    const hasSeerUserBilling = organizations.some(organization =>
      organization.features?.includes('seer-user-billing-launch')
    );

    const hasSizeAnalysisBilling = organizations.some(organization =>
      organization.features?.includes('expose-category-size-analysis')
    );

    const excludeTransactions = hasOrgWithAm3 && !hasOrgWithoutAm3;
    const includeSpans = hasOrgWithAm3;
    const includeProfileDuration =
      (hasOrgWithAm2 || hasOrgWithAm3) && hasOrgWithContinuousProfilingBilling;
    const includeSeer = hasSeerBilling;
    const includeLogs = hasLogsBilling;
    const includeSizeAnalysis = hasSizeAnalysisBilling;

    return fields.filter(field => {
      if (field.name === 'quotaSpans' && !includeSpans) {
        return false;
      }
      if (field.name === 'quotaTransactions' && excludeTransactions) {
        return false;
      }
      if (
        ['quotaProfileDuration', 'quotaProfileDurationUI'].includes(field.name) &&
        !includeProfileDuration
      ) {
        return false;
      }
      if (field.name.startsWith('quotaSeerBudget') && !includeSeer) {
        return false;
      }
      if (field.name.startsWith('quotaLogBytes') && !includeLogs) {
        return false;
      }
      if (field.name.startsWith('quotaSeerUsers') && !hasSeerUserBilling) {
        return false;
      }
      if (field.name.startsWith('quotaSize') && !includeSizeAnalysis) {
        return false;
      }
      return true;
    });
  };

  const removeNotificationMutation = useMutation({
    mutationFn: (id: string) =>
      fetchMutation({method: 'DELETE', url: `/users/me/notification-options/${id}/`}),
    onSuccess: (_, id) => {
      setApiQueryData<NotificationOptionsObject[]>(
        queryClient,
        notificationOptionsQueryKey(notificationType),
        currentNotificationOptions => {
          return currentNotificationOptions?.filter(
            option => option.id.toString() !== id.toString()
          );
        }
      );
    },
  });

  const addNotificationMutation = useMutation({
    mutationFn: (data: Omit<NotificationOptionsObject, 'id'>) =>
      fetchMutation<NotificationOptionsObject>({
        method: 'PUT',
        url: '/users/me/notification-options/',
        options: {},
        data,
      }),
    onSuccess: notificationOption => {
      setApiQueryData<NotificationOptionsObject[]>(
        queryClient,
        notificationOptionsQueryKey(notificationType),
        currentNotificationOptions => [
          ...(currentNotificationOptions ?? []),
          notificationOption,
        ]
      );
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (data: NotificationOptionsObject) =>
      fetchMutation<NotificationOptionsObject>({
        method: 'PUT',
        url: '/users/me/notification-options/',
        options: {},
        data,
      }),
    onSuccess: notificationOption => {
      // Replace the item in state
      setApiQueryData<NotificationOptionsObject[]>(
        queryClient,
        notificationOptionsQueryKey(notificationType),
        currentNotificationOptions =>
          currentNotificationOptions?.map(option => {
            if (option.id === notificationOption.id) {
              return notificationOption;
            }
            return option;
          })
      );
      addSuccessMessage(t('Updated notification setting'));
    },
    onError: () => {
      addErrorMessage(t('Unable to update notification setting'));
    },
  });

  const unlinkedSlackOrgs = getUnlinkedOrgs('slack');
  let notificationDetails = ACCOUNT_NOTIFICATION_FIELDS[notificationType]!;
  if (
    notificationType === 'quota' &&
    organizations.some(org => org.features?.includes('spend-visibility-notifications'))
  ) {
    notificationDetails = {
      ...notificationDetails,
      title: t('Spend Notifications'),
      description: t('Control the notifications you receive for organization spend.'),
    };
  }
  const {title, description} = notificationDetails;

  const entityType = isGroupedByProject(notificationType) ? 'project' : 'organization';

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
        fetchMutation({
          method: 'PUT',
          url: '/users/me/notification-options/',
          data: {
            type: fieldName,
            scopeType: 'user',
            scopeIdentifier: ConfigStore.get('user').id,
            value: data[fieldName],
          },
        }),
      onSuccess: () => trackTuningUpdated('general'),
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
        url: '/users/me/notification-providers/',
        data: {
          type: notificationType,
          scopeType: 'user',
          scopeIdentifier: ConfigStore.get('user').id,
          providers: data.provider,
        },
      }),
  });

  const renderQuotaFields = () => {
    const hasSpendVisibility = organizations.some(organization =>
      organization.features?.includes('spend-visibility-notifications')
    );
    const sourceFields = hasSpendVisibility ? SPEND_FIELDS : QUOTA_FIELDS;
    const filteredFields = filterCategoryFields(sourceFields);

    return filteredFields.map(field => {
      const schema = z.object({[field.name]: z.string()});
      return (
        <AutoSaveField
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
        </AutoSaveField>
      );
    });
  };

  const renderDefaultField = () => {
    const fieldDef =
      NOTIFICATION_SETTING_FIELDS[notificationType as NotificationSettingsType];
    if (!fieldDef?.choices) {
      return null;
    }
    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const schema = z.object({[notificationType]: z.string()});
    return (
      <AutoSaveField
        name={notificationType}
        schema={schema}
        initialValue={initialTopOptionData[notificationType] ?? 'always'}
        mutationOptions={optionMutationOptions(notificationType)}
      >
        {field => (
          <field.Layout.Row label={fieldDef.label} hintText={help}>
            <field.Select
              value={field.state.value}
              onChange={field.handleChange}
              options={choicesToOptions(fieldDef.choices)}
            />
          </field.Layout.Row>
        )}
      </AutoSaveField>
    );
  };

  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <SettingsPageHeader title={title} />
      {description && <TextBlock>{description}</TextBlock>}
      <FieldGroup
        title={
          isGroupedByProject(notificationType)
            ? t('All Projects')
            : t('All Organizations')
        }
      >
        {notificationType === 'quota' ? renderQuotaFields() : renderDefaultField()}
      </FieldGroup>
      {notificationType !== 'reports' && notificationType !== 'brokenMonitors' ? (
        <FieldGroup title={t('Delivery Method')}>
          <AutoSaveField
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
          </AutoSaveField>
        </FieldGroup>
      ) : null}
      <NotificationSettingsByEntity
        notificationType={notificationType}
        notificationOptions={notificationOptions}
        organizations={organizations}
        handleRemoveNotificationOption={id => removeNotificationMutation.mutate(id)}
        handleAddNotificationOption={option => addNotificationMutation.mutate(option)}
        handleEditNotificationOption={option => deleteNotificationMutation.mutate(option)}
        entityType={entityType}
      />
    </Fragment>
  );
}
