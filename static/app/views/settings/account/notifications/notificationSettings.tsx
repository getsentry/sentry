import React from 'react';

import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import Link from 'app/components/links/link';
import {IconMail} from 'app/icons';
import {t} from 'app/locale';
import FeedbackAlert from 'app/views/settings/account/notifications/feedbackAlert';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import {
  decideDefault,
  getParentIds,
  getStateToPutForDefault,
  mergeNotificationSettings,
  NotificationSettingsObject,
} from 'app/views/settings/account/notifications/utils';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {FieldObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

const NOTIFICATION_SETTINGS_TYPES = ['alerts', 'deploy', 'workflow', 'reports', 'email'];

const SELF_NOTIFICATION_SETTINGS_TYPES = [
  'personalActivityNotifications',
  'selfAssignOnResolve',
];

type Props = AsyncComponent['props'];

type State = {
  notificationSettings: NotificationSettingsObject;
  legacyData: {[key: string]: string};
} & AsyncComponent['state'];

class NotificationSettings extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationSettings: {},
      legacyData: {},
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [
      ['notificationSettings', `/users/me/notification-settings/`],
      ['legacyData', '/users/me/notifications/'],
    ];
  }

  getParentIds(notificationType: string): string[] {
    const {notificationSettings} = this.state;

    return getParentIds(notificationType, notificationSettings);
  }

  /* Methods responsible for updating state and hitting the API. */

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
      this.getParentIds(notificationType)
    );

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getInitialData(): {[key: string]: string} {
    const {notificationSettings} = this.state;

    return Object.fromEntries(
      NOTIFICATION_SETTINGS_TYPES.map(notificationType => [
        notificationType,
        decideDefault(notificationType, notificationSettings),
      ])
    );
  }

  getFields(notificationType: string): FieldObject[] {
    return [
      Object.assign({}, NOTIFICATION_SETTING_FIELDS[notificationType], {
        getData: data => this.getStateToPutForDefault(data, notificationType),
        help: (
          <React.Fragment>
            {NOTIFICATION_SETTING_FIELDS[notificationType].help}
            &nbsp;
            <Link to={`/settings/account/notifications/${notificationType}`}>
              Fine tune
            </Link>
          </React.Fragment>
        ),
      }),
    ] as FieldObject[];
  }

  renderBody() {
    const {legacyData} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title="Notifications" />
        <TextBlock>Control alerts that you receive.</TextBlock>
        <FeedbackAlert />
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
        >
          {NOTIFICATION_SETTINGS_TYPES.map(notificationType => (
            <JsonForm
              key={notificationType}
              title={NOTIFICATION_SETTING_FIELDS[notificationType].name}
              fields={this.getFields(notificationType)}
            />
          ))}
        </Form>
        <Form
          initialData={legacyData}
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notifications/"
        >
          <JsonForm
            title={t('My Activity')}
            fields={SELF_NOTIFICATION_SETTINGS_TYPES.map(
              type => NOTIFICATION_SETTING_FIELDS[type] as FieldObject
            )}
          />
        </Form>
        <AlertLink to="/settings/account/emails" icon={<IconMail />}>
          {t('Looking to add or remove an email address? Use the emails panel.')}
        </AlertLink>
      </React.Fragment>
    );
  }
}

export default NotificationSettings;
