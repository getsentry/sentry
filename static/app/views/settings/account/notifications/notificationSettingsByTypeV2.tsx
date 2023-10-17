import {Fragment} from 'react';
import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/types';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {Organization, OrganizationSummary} from 'sentry/types';
import {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  DefaultSettings,
  NotificationOptionsObject,
  NotificationProvidersObject,
} from 'sentry/views/settings/account/notifications/constants';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import {
  NOTIFICATION_SETTING_FIELDS_V2,
  QUOTA_FIELDS,
} from 'sentry/views/settings/account/notifications/fields2';
import NotificationSettingsByEntity from 'sentry/views/settings/account/notifications/notificationSettingsByEntity';
import {Identity} from 'sentry/views/settings/account/notifications/types';
import UnlinkedAlert from 'sentry/views/settings/account/notifications/unlinkedAlert';
import {isGroupedByProject} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  notificationType: string; // TODO(steve)? type better
  organizations: Organization[];
} & DeprecatedAsyncComponent['props'];

type State = {
  defaultSettings: DefaultSettings | null;
  identities: Identity[];
  notificationOptions: NotificationOptionsObject[];
  notificationProviders: NotificationProvidersObject[];
  organizationIntegrations: OrganizationIntegration[];
} & DeprecatedAsyncComponent['state'];

const typeMappedChildren = {
  quota: [
    'quotaErrors',
    'quotaTransactions',
    'quotaAttachments',
    'quotaReplays',
    'quotaWarnings',
    'quotaSpendAllocations',
  ],
};

const getQueryParams = (notificationType: string) => {
  // if we need multiple settings on this page
  // then omit the type so we can load all settings
  if (notificationType in typeMappedChildren) {
    return null;
  }
  return {type: notificationType};
};

class NotificationSettingsByTypeV2 extends DeprecatedAsyncComponent<Props, State> {
  // topLevelOptionFormModel = new TopLevelOptionFormModel(this.props.notificationType);

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationOptions: [],
      notificationProviders: [],
      identities: [],
      organizationIntegrations: [],
      defaultSettings: null,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;
    return [
      [
        'notificationOptions',
        `/users/me/notification-options/`,
        {query: getQueryParams(notificationType)},
      ],
      [
        'notificationProviders',
        `/users/me/notification-providers/`,
        {query: getQueryParams(notificationType)},
      ],
      ['identities', `/users/me/identities/`, {query: {provider: 'slack'}}],
      [
        'organizationIntegrations',
        `/users/me/organization-integrations/`,
        {query: {provider: 'slack'}},
      ],
      ['defaultSettings', '/notification-defaults/'],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    trackAnalytics('notification_settings.tuning_page_viewed', {
      organization: null,
      notification_type: this.props.notificationType,
    });
  }

  trackTuningUpdated(tuningFieldType: string) {
    trackAnalytics('notification_settings.updated_tuning_setting', {
      organization: null,
      notification_type: this.props.notificationType,
      tuning_field_type: tuningFieldType,
    });
  }

  getInitialTopOptionData(): {[key: string]: string} {
    const {notificationType} = this.props;
    const {notificationOptions, defaultSettings} = this.state;
    const matchedOption = notificationOptions.find(
      option => option.type === notificationType && option.scopeType === 'user'
    );
    // if no match, fall back to the
    let defaultValue: string;
    if (!matchedOption) {
      if (defaultSettings) {
        defaultValue = defaultSettings.typeDefaults[notificationType];
      } else {
        // should never happen
        defaultValue = 'never';
      }
    } else {
      defaultValue = matchedOption.value;
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
  }

  getProviderInitialData(): {[key: string]: string[]} {
    const {notificationType} = this.props;
    const {notificationProviders, defaultSettings} = this.state;

    const relevantProviderSettings = notificationProviders.filter(
      option => option.scopeType === 'user' && option.type === notificationType
    );
    // user has no settings saved so use default
    if (relevantProviderSettings.length === 0 && defaultSettings) {
      return {provider: defaultSettings.providerDefaults};
    }
    const providers = relevantProviderSettings
      .filter(option => option.value === 'always')
      .map(option => option.provider);
    return {provider: providers};
  }

  getFields(): Field[] {
    const {notificationType} = this.props;

    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const fields: Field[] = [];
    // if a quota notification is not disabled, add in our dependent fields
    // but do not show the top level controller
    if (notificationType === 'quota') {
      fields.push(
        ...QUOTA_FIELDS.map(field => ({
          ...field,
          type: 'select' as const,
          getData: data => {
            return {
              type: field.name,
              scopeType: 'user',
              scopeIdentifier: ConfigStore.get('user').id,
              value: data[field.name],
            };
          },
        }))
      );
    } else {
      const defaultField: Field = Object.assign(
        {},
        NOTIFICATION_SETTING_FIELDS_V2[notificationType],
        {
          help,
          defaultValue: 'always',
          getData: data => {
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
  }

  getProviderFields(): Field[] {
    const {notificationType} = this.props;
    const {organizationIntegrations} = this.state;
    // get the choices but only the ones that are available to the user
    const choices = (
      NOTIFICATION_SETTING_FIELDS_V2.provider.choices as [string, string][]
    ).filter(([providerSlug]) => {
      if (providerSlug === 'email') {
        return true;
      }
      return organizationIntegrations.some(
        organizationIntegration => organizationIntegration.provider.slug === providerSlug
      );
    });

    const defaultField = Object.assign({}, NOTIFICATION_SETTING_FIELDS_V2.provider, {
      choices,
      getData: data => {
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
  }

  getUnlinkedOrgs = (): OrganizationSummary[] => {
    const {organizations} = this.props;
    const {identities, organizationIntegrations} = this.state;
    const integrationExternalIDsByOrganizationID = Object.fromEntries(
      organizationIntegrations.map(organizationIntegration => [
        organizationIntegration.organizationId,
        organizationIntegration.externalId,
      ])
    );

    const identitiesByExternalId = Object.fromEntries(
      identities.map(identity => [identity?.identityProvider?.externalId, identity])
    );

    return organizations.filter(organization => {
      const externalID = integrationExternalIDsByOrganizationID[organization.id];
      const identity = identitiesByExternalId[externalID];
      return identity === undefined || identity === null;
    });
  };

  handleRemoveNotificationOption = async (id: string) => {
    await this.api.requestPromise(`/users/me/notification-options/${id}/`, {
      method: 'DELETE',
    });
    this.setState(state => {
      const newNotificationOptions = state.notificationOptions.filter(
        option => !(option.id.toString() === id.toString())
      );
      return {
        ...state,
        notificationOptions: newNotificationOptions,
      };
    });
  };

  handleAddNotificationOption = async (data: Omit<NotificationOptionsObject, 'id'>) => {
    // TODO: add error handling
    const notificationOption = await this.api.requestPromise(
      '/users/me/notification-options/',
      {
        method: 'PUT',
        data,
      }
    );

    this.setState(state => {
      return {
        ...state,
        notificationOptions: [...state.notificationOptions, notificationOption],
      };
    });
  };

  renderBody() {
    const {notificationType} = this.props;
    const {notificationOptions} = this.state;
    const hasSlack = true;
    const unlinkedOrgs = this.getUnlinkedOrgs();
    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];
    const entityType = isGroupedByProject(notificationType) ? 'project' : 'organization';
    return (
      <Fragment>
        <SentryDocumentTitle title={title} />
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        {hasSlack && unlinkedOrgs.length > 0 && (
          <UnlinkedAlert organizations={unlinkedOrgs} />
        )}
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-options/"
          initialData={this.getInitialTopOptionData()}
          onSubmitSuccess={() => this.trackTuningUpdated('general')}
        >
          <TopJsonForm
            title={
              isGroupedByProject(notificationType)
                ? t('All Projects')
                : t('All Organizations')
            }
            fields={this.getFields()}
          />
        </Form>
        {notificationType !== 'reports' ? (
          <Form
            saveOnBlur
            apiMethod="PUT"
            apiEndpoint="/users/me/notification-providers/"
            initialData={this.getProviderInitialData()}
          >
            <BottomJsonForm fields={this.getProviderFields()} />
          </Form>
        ) : null}
        <NotificationSettingsByEntity
          notificationType={notificationType}
          notificationOptions={notificationOptions}
          organizations={this.props.organizations}
          handleRemoveNotificationOption={this.handleRemoveNotificationOption}
          handleAddNotificationOption={this.handleAddNotificationOption}
          entityType={entityType}
        />
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettingsByTypeV2);

export const TopJsonForm = styled(JsonForm)`
  ${Panel} {
    border-bottom: 0;
    margin-bottom: 0;
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }
`;

export const BottomJsonForm = styled(JsonForm)`
  ${Panel} {
    border-top-right-radius: 0;
    border-top-left-radius: 0;
  }
`;
