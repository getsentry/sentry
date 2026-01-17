import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Observer} from 'mobx-react-lite';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import type {Field} from 'sentry/components/forms/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
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
import {ACCOUNT_NOTIFICATION_FIELDS} from './fields';
import {NOTIFICATION_SETTING_FIELDS, QUOTA_FIELDS, SPEND_FIELDS} from './fields2';
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
  [`/users/me/notification-options/`, {query: getQueryParams(notificationType)}] as const;

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
      [`/users/me/notification-providers/`, {query: getQueryParams(notificationType)}],
      {staleTime: 30_000}
    );
  const {data: identities = [], status: identitiesStatus} = useApiQuery<Identity[]>(
    [`/users/me/identities/`, {query: {provider: 'slack'}}],
    {staleTime: 30_000}
  );
  const {data: organizationIntegrations = [], status: organizationIntegrationStatus} =
    useApiQuery<OrganizationIntegration[]>(
      [`/users/me/organization-integrations/`, {query: {provider: 'slack'}}],
      {staleTime: 30_000}
    );
  const {data: defaultSettings, status: defaultSettingsStatus} =
    useApiQuery<DefaultSettings>(['/notification-defaults/'], {staleTime: 30_000});
  const [providerModel] = useState(() => new FormModel());

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

  const filterCategoryFields = (fields: Field[]) => {
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

    const hasSeerUserBilling = organizations.some(
      organization =>
        organization.features?.includes('seer-user-billing') &&
        organization.features?.includes('seer-user-billing-launch')
    );

    const excludeTransactions = hasOrgWithAm3 && !hasOrgWithoutAm3;
    const includeSpans = hasOrgWithAm3;
    const includeProfileDuration =
      (hasOrgWithAm2 || hasOrgWithAm3) && hasOrgWithContinuousProfilingBilling;
    const includeSeer = hasSeerBilling;
    const includeLogs = hasLogsBilling;

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
      return true;
    });
  };

  const getFields = (): Field[] => {
    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const fields: Field[] = [];

    // if a quota notification is not disabled, add in our dependent fields
    // but do not show the top level controller
    if (notificationType === 'quota') {
      if (
        organizations.some(organization =>
          organization.features?.includes('spend-visibility-notifications')
        )
      ) {
        fields.push(
          ...filterCategoryFields(
            SPEND_FIELDS.map(field => ({
              ...field,
              type: 'select' as const,
              getData: (data: Record<PropertyKey, unknown>) => {
                return {
                  type: field.name,
                  scopeType: 'user',
                  scopeIdentifier: ConfigStore.get('user').id,
                  value: data[field.name],
                };
              },
            }))
          )
        );
      } else {
        // TODO(isabella): Once GA, remove this case
        fields.push(
          ...filterCategoryFields(
            QUOTA_FIELDS.map(field => ({
              ...field,
              type: 'select' as const,
              getData: (data: Record<PropertyKey, unknown>) => {
                return {
                  type: field.name,
                  scopeType: 'user',
                  scopeIdentifier: ConfigStore.get('user').id,
                  value: data[field.name],
                };
              },
            }))
          )
        );
      }
    } else {
      const defaultField: Field = Object.assign(
        {},
        NOTIFICATION_SETTING_FIELDS[notificationType as NotificationSettingsType],
        {
          help,
          defaultValue: 'always',
          getData: (data: Record<PropertyKey, unknown>) => {
            return {
              type: notificationType,
              scopeType: 'user',
              scopeIdentifier: ConfigStore.get('user').id,
              value: data[notificationType],
            };
          },
        }
      );
      fields.push(defaultField);
    }

    return fields;
  };

  const getProviderFields = (): Field[] => {
    // get the choices but only the ones that are available to the user
    const choices = (
      NOTIFICATION_SETTING_FIELDS.provider.choices as Array<[SupportedProviders, string]>
    ).filter(([providerSlug]) => isProviderSupported(providerSlug));

    const defaultField = Object.assign({}, NOTIFICATION_SETTING_FIELDS.provider, {
      choices,
      getData: (data: Record<PropertyKey, unknown>) => {
        return {
          type: notificationType,
          scopeType: 'user',
          scopeIdentifier: ConfigStore.get('user').id,
          providers: data.provider,
          value: data[notificationType],
        };
      },
    });
    const fields: Field[] = [defaultField];
    return fields;
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
  // TODO(isabella): Once GA, remove this
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

  return (
    <Fragment>
      <SentryDocumentTitle title={title} />
      <SettingsPageHeader title={title} />
      {description && <TextBlock>{description}</TextBlock>}
      <Observer>
        {() => {
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          return providerModel.getValue('provider')?.toString().includes('slack') &&
            unlinkedSlackOrgs.length > 0 ? (
            <UnlinkedAlert organizations={unlinkedSlackOrgs} />
          ) : null;
        }}
      </Observer>
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint="/users/me/notification-options/"
        initialData={getInitialTopOptionData()}
        onSubmitSuccess={() => trackTuningUpdated('general')}
      >
        <TopJsonForm
          title={
            isGroupedByProject(notificationType)
              ? t('All Projects')
              : t('All Organizations')
          }
          fields={getFields()}
        />
      </Form>
      {notificationType !== 'reports' && notificationType !== 'brokenMonitors' ? (
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-providers/"
          initialData={{provider: getProviders()}}
          model={providerModel}
        >
          <BottomJsonForm fields={getProviderFields()} />
        </Form>
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

const TopJsonForm = styled(JsonForm)`
  ${Panel} {
    border-bottom: 0;
    margin-bottom: 0;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

const BottomJsonForm = styled(JsonForm)`
  ${Panel} {
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`;
