import {Fragment} from 'react';

import AsyncComponent from 'sentry/components/asyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import {Organization, OrganizationSummary} from 'sentry/types';
import {OrganizationIntegration} from 'sentry/types/integrations';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  ALL_PROVIDER_NAMES,
  CONFIRMATION_MESSAGE,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'sentry/views/settings/account/notifications/constants';
import FeedbackAlert from 'sentry/views/settings/account/notifications/feedbackAlert';
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
  providerListToString,
} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = {
  notificationType: string;
  organizations: Organization[];
} & AsyncComponent['props'];

type State = {
  identities: Identity[];
  notificationSettings: NotificationSettingsObject;
  organizationIntegrations: OrganizationIntegration[];
} & AsyncComponent['state'];

const typeMappedChildren = {
  quota: ['quotaErrors', 'quotaTransactions', 'quotaAttachments', 'quotaWarnings'],
};

const getQueryParams = (notificationType: string) => {
  // if we need multiple settings on this page
  // then omit the type so we can load all settings
  if (notificationType in typeMappedChildren) {
    return null;
  }
  return {type: notificationType};
};

class NotificationSettingsByType extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationSettings: {},
      identities: [],
      organizationIntegrations: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;
    return [
      [
        'notificationSettings',
        `/users/me/notification-settings/`,
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
    trackAdvancedAnalyticsEvent('notification_settings.tuning_page_viewed', {
      organization: null,
      notification_type: this.props.notificationType,
    });
  }

  trackTuningUpdated(tuningFieldType: string) {
    trackAdvancedAnalyticsEvent('notification_settings.updated_tuning_setting', {
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

  getInitialData(): {[key: string]: string} {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const initialData = {
      [notificationType]: getCurrentDefault(notificationType, notificationSettings),
    };
    if (!isEverythingDisabled(notificationType, notificationSettings)) {
      initialData.provider = providerListToString(
        getCurrentProviders(notificationType, notificationSettings)
      );
    }
    const childTypes: string[] = typeMappedChildren[notificationType] || [];
    childTypes.forEach(childType => {
      initialData[childType] = getCurrentDefault(childType, notificationSettings);
    });
    return initialData;
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
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        {hasSlack && unlinkedOrgs.length > 0 && (
          <UnlinkedAlert organizations={unlinkedOrgs} />
        )}
        <FeedbackAlert />
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
