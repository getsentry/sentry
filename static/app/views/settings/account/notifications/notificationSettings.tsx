import React from 'react';

import AlertLink from 'app/components/alertLink';
import AsyncComponent from 'app/components/asyncComponent';
import Link from 'app/components/links/link';
import {IconMail} from 'app/icons';
import {t} from 'app/locale';
import {
  NOTIFICATION_SETTINGS_TYPES,
  NotificationSettingsObject,
  SELF_NOTIFICATION_SETTINGS_TYPES,
} from 'app/views/settings/account/notifications/constants';
import FeedbackAlert from 'app/views/settings/account/notifications/feedbackAlert';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import {
  decideDefault,
  getParentIds,
  getStateToPutForDefault,
  mergeNotificationSettings,
} from 'app/views/settings/account/notifications/utils';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {FieldObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

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

  getInitialData(): {[key: string]: string} {
    const {notificationSettings} = this.state;

    return Object.fromEntries(
      NOTIFICATION_SETTINGS_TYPES.map(notificationType => [
        notificationType,
        decideDefault(notificationType, notificationSettings),
      ])
    );
  }

  getFields(): FieldObject[] {
    return NOTIFICATION_SETTINGS_TYPES.map(
      notificationType =>
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
        }) as FieldObject
    );
  }

  renderBody() {
    const {legacyData} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title="Notifications" />
        <TextBlock>Personal notifications sent via email or an integration.</TextBlock>
        <FeedbackAlert />
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
        >
          <JsonForm title={t('Notifications')} fields={this.getFields()} />
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
