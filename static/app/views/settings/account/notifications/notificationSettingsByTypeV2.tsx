import {Fragment} from 'react';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/types';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {Organization, OrganizationSummary} from 'sentry/types';
import {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  NotificationOptionsObject,
  NotificationProvidersObject,
} from 'sentry/views/settings/account/notifications/constants';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import NotificationSettingsByProjects from 'sentry/views/settings/account/notifications/notificationSettingsByEntity';
import {Identity} from 'sentry/views/settings/account/notifications/types';
import UnlinkedAlert from 'sentry/views/settings/account/notifications/unlinkedAlert';
import {isGroupedByProject} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  notificationType: string;
  organizations: Organization[];
} & DeprecatedAsyncComponent['props'];

type State = {
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
    const {notificationOptions} = this.state;
    const matchedOption = notificationOptions.find(
      option =>
        option.notificationType === notificationType && option.scopeType === 'user'
    );
    if (!matchedOption) {
      return {};
    }
    return {
      [notificationType]: matchedOption.value,
    };
  }

  getProviderData(): {[key: string]: string[]} {
    const {notificationProviders} = this.state;
    const providers = notificationProviders
      .filter(option => option.scopeType === 'user' && option.value === 'always')
      .map(option => option.provider);

    return {provider: providers};
  }

  getFields(): Field[] {
    const {notificationType} = this.props;

    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const defaultField: Field = Object.assign(
      {},
      NOTIFICATION_SETTING_FIELDS[notificationType],
      {
        help,
        defaultValue: 'always',
        getData: data => {
          return {
            notificationType,
            scopeType: 'user',
            scopeIdentifier: ConfigStore.get('user').id,
            value: data[notificationType],
          };
        },
      }
    );
    const fields: Field[] = [defaultField];
    return fields;
  }

  getProviderFields(): Field[] {
    const {notificationType} = this.props;
    const {organizationIntegrations} = this.state;
    const defaultField = Object.assign({}, NOTIFICATION_SETTING_FIELDS.provider, {
      choices: organizationIntegrations
        .map(organizationIntegration => [
          organizationIntegration.provider.slug,
          organizationIntegration.provider.name,
        ])
        .concat([['email', 'Email']]),
      getData: data => {
        return {
          notificationType,
          scopeType: 'user',
          scopeIdentifier: ConfigStore.get('user').id,
          provider: data.provider,
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

  handleRemoveNotificationOption = (
    notificationOption: Pick<
      NotificationOptionsObject,
      'notificationType' | 'scopeType' | 'scopeIdentifier'
    >
  ) => {
    this.setState(state => {
      const newNotificationOptions = state.notificationOptions.filter(
        option =>
          !(
            option.notificationType === notificationOption.notificationType &&
            option.scopeType === notificationOption.scopeType &&
            option.scopeIdentifier === notificationOption.scopeIdentifier
          )
      );
      return {
        ...state,
        notificationOptions: newNotificationOptions,
      };
    });
  };

  handleAddNotificationOption = (notificationOption: NotificationOptionsObject) => {
    this.setState(state => {
      const newNotificationOptions = state.notificationOptions.concat([
        notificationOption,
      ]);
      return {
        ...state,
        notificationOptions: newNotificationOptions,
      };
    });
  };

  renderBody() {
    const {notificationType} = this.props;
    const {notificationOptions} = this.state;
    const hasSlack = true;
    const unlinkedOrgs = this.getUnlinkedOrgs();
    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];
    const entity = isGroupedByProject(notificationType) ? 'project' : 'organization';
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
          <JsonForm
            title={
              isGroupedByProject(notificationType)
                ? t('All Projects')
                : t('All Organizations')
            }
            fields={this.getFields()}
          />
        </Form>
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-providers/"
          initialData={this.getProviderData()}
        >
          <JsonForm fields={this.getProviderFields()} />
        </Form>
        <NotificationSettingsByProjects
          notificationType={notificationType}
          notificationOptions={notificationOptions}
          onSubmitSuccess={() => this.trackTuningUpdated(entity)}
          organizations={this.props.organizations}
          handleRemoveNotificationOption={this.handleRemoveNotificationOption}
          handleAddNotificationOption={this.handleAddNotificationOption}
          entity={entity}
        />
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettingsByTypeV2);
