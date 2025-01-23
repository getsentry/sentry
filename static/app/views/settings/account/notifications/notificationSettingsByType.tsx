import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import type {Field} from 'sentry/components/forms/types';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization, OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganizations from 'sentry/utils/withOrganizations';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import type {
  DefaultSettings,
  NotificationOptionsObject,
  NotificationProvidersObject,
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
  quota: QUOTA_FIELDS.map(field => field.name),
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
  providerModel = new FormModel();

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
        defaultValue = defaultSettings.typeDefaults[notificationType]!;
      } else {
        // should never happen
        defaultValue = 'never';
      }
    } else {
      defaultValue = matchedOption.value;
    }
    // if we have child types, map the default
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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

  isProviderSupported = (provider: SupportedProviders) => {
    // email is always possible
    if (provider === 'email') {
      return true;
    }
    return this.getLinkedOrgs(provider).length > 0;
  };

  getProviders(): SupportedProviders[] {
    const {notificationType} = this.props;
    const {notificationProviders, defaultSettings} = this.state;

    const relevantProviderSettings = notificationProviders.filter(
      option => option.scopeType === 'user' && option.type === notificationType
    );

    return SUPPORTED_PROVIDERS.filter(this.isProviderSupported).filter(provider => {
      const providerSetting = relevantProviderSettings.find(
        option => option.provider === provider
      );
      // if there is a matched setting use that, otherwise check provider defaults
      return providerSetting
        ? providerSetting.value === 'always'
        : defaultSettings?.providerDefaults.includes(provider);
    });
  }

  getFields(): Field[] {
    const {notificationType, organizations} = this.props;

    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const fields: Field[] = [];

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

    const excludeTransactions = hasOrgWithAm3 && !hasOrgWithoutAm3;
    const includeSpans = hasOrgWithAm3;
    const includeProfileDuration = hasOrgWithAm2 || hasOrgWithAm3;

    // if a quota notification is not disabled, add in our dependent fields
    // but do not show the top level controller
    if (notificationType === 'quota') {
      if (
        organizations.some(organization =>
          organization.features?.includes('spend-visibility-notifications')
        )
      ) {
        fields.push(
          ...SPEND_FIELDS.filter(field => {
            if (field.name === 'quotaSpans' && !includeSpans) {
              return false;
            }
            if (field.name === 'quotaTransactions' && excludeTransactions) {
              return false;
            }
            if (field.name === 'quotaProfileDuration' && !includeProfileDuration) {
              return false;
            }
            return true;
          }).map(field => ({
            ...field,
            type: 'select' as const,
            getData: (data: any) => {
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
        // TODO(isabella): Once GA, remove this case
        fields.push(
          ...QUOTA_FIELDS.filter(field => {
            if (field.name === 'quotaSpans' && !includeSpans) {
              return false;
            }
            if (field.name === 'quotaTransactions' && excludeTransactions) {
              return false;
            }
            if (field.name === 'quotaProfileDuration' && !includeProfileDuration) {
              return false;
            }
            return true;
          }).map(field => ({
            ...field,
            type: 'select' as const,
            getData: (data: any) => {
              return {
                type: field.name,
                scopeType: 'user',
                scopeIdentifier: ConfigStore.get('user').id,
                value: data[field.name],
              };
            },
          }))
        );
      }
    } else {
      const defaultField: Field = Object.assign(
        {},
        NOTIFICATION_SETTING_FIELDS[notificationType],
        {
          help,
          defaultValue: 'always',
          getData: (data: any) => {
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
    // get the choices but only the ones that are available to the user
    const choices = (
      NOTIFICATION_SETTING_FIELDS.provider!.choices as [SupportedProviders, string][]
    ).filter(([providerSlug]) => this.isProviderSupported(providerSlug));

    const defaultField = Object.assign({}, NOTIFICATION_SETTING_FIELDS.provider, {
      choices,
      getData: (data: any) => {
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

  getLinkedOrgs = (provider: SupportedProviders): OrganizationSummary[] => {
    const {organizations} = this.props;
    const {identities, organizationIntegrations} = this.state;
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

  getUnlinkedOrgs = (provider: SupportedProviders): OrganizationSummary[] => {
    const linkedOrgs = this.getLinkedOrgs(provider);
    const {organizations} = this.props;
    return organizations.filter(organization => !linkedOrgs.includes(organization));
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
        notificationOptions: [...state.notificationOptions, notificationOption],
      };
    });
  };

  handleEditNotificationOption = async (data: NotificationOptionsObject) => {
    try {
      const notificationOption: NotificationOptionsObject = await this.api.requestPromise(
        '/users/me/notification-options/',
        {
          method: 'PUT',
          data,
        }
      );
      this.setState(state => {
        // Replace the item in state
        const newNotificationOptions = state.notificationOptions.map(option => {
          if (option.id === data.id) {
            return notificationOption;
          }
          return option;
        });

        return {notificationOptions: newNotificationOptions};
      });
      addSuccessMessage(t('Updated notification setting'));
    } catch (err) {
      addErrorMessage(t('Unable to update notification setting'));
    }
  };

  renderBody() {
    const {notificationType, organizations} = this.props;
    const {notificationOptions} = this.state;
    const unlinkedSlackOrgs = this.getUnlinkedOrgs('slack');
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
    return (
      <Fragment>
        <SentryDocumentTitle title={title} />
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        <Observer>
          {() => {
            return this.providerModel
              .getValue('provider')
              ?.toString()
              .includes('slack') && unlinkedSlackOrgs.length > 0 ? (
              <UnlinkedAlert organizations={unlinkedSlackOrgs} />
            ) : null;
          }}
        </Observer>
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
        {notificationType !== 'reports' && notificationType !== 'brokenMonitors' ? (
          <Form
            saveOnBlur
            apiMethod="PUT"
            apiEndpoint="/users/me/notification-providers/"
            initialData={{provider: this.getProviders()}}
            model={this.providerModel}
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
          handleEditNotificationOption={this.handleEditNotificationOption}
          entityType={entityType}
        />
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettingsByTypeV2);

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
