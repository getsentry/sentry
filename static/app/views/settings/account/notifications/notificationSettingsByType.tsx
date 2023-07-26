import {Fragment} from 'react';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/types';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {Organization, OrganizationSummary} from 'sentry/types';
import {OrganizationIntegration} from 'sentry/types/integrations';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  ALL_PROVIDER_NAMES,
  CONFIRMATION_MESSAGE,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'sentry/views/settings/account/notifications/constants';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'sentry/views/settings/account/notifications/fields';
import {
  NOTIFICATION_SETTING_FIELDS,
  QUOTA_FIELDS,
} from 'sentry/views/settings/account/notifications/fields2';
import NotificationSettingsByOrganization from 'sentry/views/settings/account/notifications/notificationSettingsByOrganization';
import NotificationSettingsByProjects from 'sentry/views/settings/account/notifications/notificationSettingsByProjects';
import {Identity} from 'sentry/views/settings/account/notifications/types';
import UnlinkedAlert from 'sentry/views/settings/account/notifications/unlinkedAlert';
import {
  getCurrentDefault,
  getCurrentProviders,
  getParentIds,
  getStateToPutForDefault,
  getStateToPutForParent,
  getStateToPutForProvider,
  isEverythingDisabled,
  isGroupedByProject,
  isSufficientlyComplex,
  mergeNotificationSettings,
} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  notificationType: string;
  organizations: Organization[];
} & DeprecatedAsyncComponent['props'];

type State = {
  identities: Identity[];
  notificationSettings: NotificationSettingsObject;
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

class NotificationSettingsByType extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationSettings: {},
      identities: [],
      organizationIntegrations: [],
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;
    return [
      [
        'notificationSettings',
        `/users/me/notification-settings/`,
        {query: getQueryParams(notificationType), v2: 'serializer'},
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

  /* Methods responsible for updating state and hitting the API. */

  getStateToPutForProvider = (
    changedData: NotificationSettingsByProviderObject
  ): NotificationSettingsObject => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const updatedNotificationSettings = getStateToPutForProvider(
      notificationType,
      notificationSettings,
      changedData
    );

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForDependentSetting = (
    changedData: NotificationSettingsByProviderObject,
    notificationType: string
  ) => {
    const value = changedData[notificationType];
    const {notificationSettings} = this.state;

    // parent setting will control the which providers we send to
    // just set every provider to the same value for the child/dependent setting
    const userSettings = ALL_PROVIDER_NAMES.reduce((accum, provider) => {
      accum[provider] = value;
      return accum;
    }, {});

    // setting is a user-only setting
    const updatedNotificationSettings = {
      [notificationType]: {
        user: {
          me: userSettings,
        },
      },
    };

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForDefault = (
    changedData: NotificationSettingsByProviderObject
  ): NotificationSettingsObject => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const updatedNotificationSettings = getStateToPutForDefault(
      notificationType,
      notificationSettings,
      changedData,
      getParentIds(notificationType, notificationSettings)
    );

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForParent = (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ): NotificationSettingsObject => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const updatedNotificationSettings = getStateToPutForParent(
      notificationType,
      notificationSettings,
      changedData,
      parentId
    );

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });
    return updatedNotificationSettings;
  };

  /* Methods responsible for rendering the page. */

  getInitialData(): {[key: string]: string | string[]} {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    // TODO: Backend should be in charge of providing defaults since it depends on the type
    const provider = !isEverythingDisabled(notificationType, notificationSettings)
      ? getCurrentProviders(notificationType, notificationSettings)
      : ['email', 'slack'];

    const childTypes: string[] = typeMappedChildren[notificationType] || [];
    const childTypesDefaults = Object.fromEntries(
      childTypes.map(childType => [
        childType,
        getCurrentDefault(childType, notificationSettings),
      ])
    );

    return {
      [notificationType]: getCurrentDefault(notificationType, notificationSettings),
      provider,
      ...childTypesDefaults,
    };
  }

  getFields(): Field[] {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const help = isGroupedByProject(notificationType)
      ? t('This is the default for all projects.')
      : t('This is the default for all organizations.');

    const defaultField: Field = Object.assign(
      {},
      NOTIFICATION_SETTING_FIELDS[notificationType],
      {
        help,
        getData: data => this.getStateToPutForDefault(data),
      }
    );
    if (isSufficientlyComplex(notificationType, notificationSettings)) {
      defaultField.confirm = {never: CONFIRMATION_MESSAGE};
    }

    const fields: Field[] = [defaultField];
    if (!isEverythingDisabled(notificationType, notificationSettings)) {
      fields.push(
        Object.assign(
          {
            help: t('Where personal notifications will be sent.'),
            getData: data => this.getStateToPutForProvider(data),
          },
          NOTIFICATION_SETTING_FIELDS.provider
        )
      );
    }

    // if a quota notification is not disabled, add in our dependent fields
    if (
      notificationType === 'quota' &&
      !isEverythingDisabled(notificationType, notificationSettings)
    ) {
      fields.push(
        ...QUOTA_FIELDS.map(field => ({
          ...field,
          type: 'select' as const,
          getData: data =>
            this.getStateToPutForDependentSetting(
              data as NotificationSettingsByProviderObject,
              field.name
            ),
        }))
      );
    }

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

  renderBody() {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;
    const hasSlack = getCurrentProviders(notificationType, notificationSettings).includes(
      'slack'
    );
    const unlinkedOrgs = this.getUnlinkedOrgs();
    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];
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
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
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
        {!isEverythingDisabled(notificationType, notificationSettings) &&
          (isGroupedByProject(notificationType) ? (
            <NotificationSettingsByProjects
              notificationType={notificationType}
              notificationSettings={notificationSettings}
              onChange={this.getStateToPutForParent}
              onSubmitSuccess={() => this.trackTuningUpdated('project')}
              organizations={this.props.organizations}
            />
          ) : (
            <NotificationSettingsByOrganization
              notificationType={notificationType}
              notificationSettings={notificationSettings}
              onChange={this.getStateToPutForParent}
              onSubmitSuccess={() => this.trackTuningUpdated('organization')}
            />
          ))}
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettingsByType);
