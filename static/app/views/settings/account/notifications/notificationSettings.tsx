import {Fragment} from 'react';

import AlertLink from 'sentry/components/alertLink';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import FormModel from 'sentry/components/forms/model';
import {FieldObject} from 'sentry/components/forms/types';
import Link from 'sentry/components/links/link';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  CONFIRMATION_MESSAGE,
  NOTIFICATION_FEATURE_MAP,
  NOTIFICATION_SETTINGS_PATHNAMES,
  NOTIFICATION_SETTINGS_TYPES,
  NotificationSettingsObject,
  SELF_NOTIFICATION_SETTINGS_TYPES,
} from 'sentry/views/settings/account/notifications/constants';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import {
  decideDefault,
  getParentIds,
  getStateToPutForDefault,
  isSufficientlyComplex,
  mergeNotificationSettings,
} from 'sentry/views/settings/account/notifications/utils';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = DeprecatedAsyncComponent['props'] & {
  organizations: Organization[];
};

type State = {
  legacyData: {[key: string]: string};
  notificationSettings: NotificationSettingsObject;
} & DeprecatedAsyncComponent['state'];

class NotificationSettings extends DeprecatedAsyncComponent<Props, State> {
  model = new FormModel();

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationSettings: {},
      legacyData: {},
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [
      ['notificationSettings', `/users/me/notification-settings/`, {v2: 'serializer'}],
      ['legacyData', '/users/me/notifications/'],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    // only tied to a user
    trackAnalytics('notification_settings.index_page_viewed', {
      organization: null,
    });
  }

  getStateToPutForDefault = (
    changedData: {[key: string]: string},
    notificationType: string
  ) => {
    /**
     * Update the current providers' parent-independent notification settings
     * with the new value. If the new value is "never", then also update all
     * parent-specific notification settings to "default". If the previous value
     * was "never", then assume providerList should be "email" only.
     */

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

  checkFeatureFlag(flag: string) {
    return this.props.organizations.some(org => org.features?.includes(flag));
  }

  get notificationSettingsType() {
    // filter out notification settings if the feature flag isn't set
    return NOTIFICATION_SETTINGS_TYPES.filter(type => {
      const notificationFlag = NOTIFICATION_FEATURE_MAP[type];
      if (notificationFlag) {
        return this.checkFeatureFlag(notificationFlag);
      }
      return true;
    });
  }

  getInitialData(): {[key: string]: string} {
    const {notificationSettings, legacyData} = this.state;

    const notificationsInitialData = Object.fromEntries(
      this.notificationSettingsType.map(notificationType => [
        notificationType,
        decideDefault(notificationType, notificationSettings),
      ])
    );

    const allInitialData = {
      ...notificationsInitialData,
      ...legacyData,
    };

    return allInitialData;
  }

  getFields(): FieldObject[] {
    const {notificationSettings} = this.state;

    const fields: FieldObject[] = [];
    const endOfFields: FieldObject[] = [];
    for (const notificationType of this.notificationSettingsType) {
      const field = Object.assign({}, NOTIFICATION_SETTING_FIELDS[notificationType], {
        getData: data => this.getStateToPutForDefault(data, notificationType),
        help: (
          <Fragment>
            <p>
              {NOTIFICATION_SETTING_FIELDS[notificationType].help}
              &nbsp;
              <Link
                data-test-id="fine-tuning"
                to={`/settings/account/notifications/${NOTIFICATION_SETTINGS_PATHNAMES[notificationType]}`}
              >
                Fine tune
              </Link>
            </p>
          </Fragment>
        ),
      }) as any;

      if (
        isSufficientlyComplex(notificationType, notificationSettings) &&
        typeof field !== 'function'
      ) {
        field.confirm = {never: CONFIRMATION_MESSAGE};
      }
      if (field.type === 'blank') {
        endOfFields.push(field);
      } else {
        fields.push(field);
      }
    }

    const legacyField = SELF_NOTIFICATION_SETTINGS_TYPES.map(
      type => NOTIFICATION_SETTING_FIELDS[type] as FieldObject
    );

    fields.push(...legacyField);

    const allFields = [...fields, ...endOfFields];

    return allFields;
  }

  onFieldChange = (fieldName: string) => {
    if (SELF_NOTIFICATION_SETTINGS_TYPES.includes(fieldName)) {
      this.model.setFormOptions({apiEndpoint: '/users/me/notifications/'});
    } else {
      this.model.setFormOptions({apiEndpoint: '/users/me/notification-settings/'});
    }
  };

  renderBody() {
    return (
      <Fragment>
        <SentryDocumentTitle title={t('Notifications')} />
        <SettingsPageHeader title={t('Notifications')} />
        <TextBlock>
          {t('Personal notifications sent by email or an integration.')}
        </TextBlock>
        <Form
          model={this.model}
          saveOnBlur
          apiMethod="PUT"
          onFieldChange={this.onFieldChange}
          initialData={this.getInitialData()}
        >
          <JsonForm title={t('Notifications')} fields={this.getFields()} />
        </Form>
        <AlertLink to="/settings/account/emails" icon={<IconMail />}>
          {t('Looking to add or remove an email address? Use the emails panel.')}
        </AlertLink>
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettings);
