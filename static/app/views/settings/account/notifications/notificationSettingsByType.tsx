import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {t} from 'app/locale';
// import {Identity} from 'app/types';
import {
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'app/views/settings/account/notifications/constants';
import FeedbackAlert from 'app/views/settings/account/notifications/feedbackAlert';
import UnlinkedAlert from 'app/views/settings/account/notifications/unlinkedAlert';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'app/views/settings/account/notifications/fields';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import NotificationSettingsByOrganization from 'app/views/settings/account/notifications/notificationSettingsByOrganization';
import NotificationSettingsByProjects from 'app/views/settings/account/notifications/notificationSettingsByProjects';
import {
  getCurrentDefault,
  getCurrentProviders,
  getParentIds,
  getStateToPutForDefault,
  getStateToPutForParent,
  getStateToPutForProvider,
  unlinkedSlacks,
  isEverythingDisabled,
  isGroupedByProject,
  mergeNotificationSettings,
  providerListToString,
} from 'app/views/settings/account/notifications/utils';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {FieldObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = {
  notificationType: string;
} & AsyncComponent['props'];

type State = {
  // identities: Identity[] | null;
  notificationSettings: NotificationSettingsObject;
} & AsyncComponent['state'];

class NotificationSettingsByType extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      // identities: [],
      notificationSettings: {},
    };
  }

  getSlackIdentities = (data) => {
    console.log({data})
    return data;
    // let slackIdentities = [];
    // for (const identity of data) {
    //   if (identity.provider == "slack") {
    //     slackIdentities.push(identity);
    //   }
    // }
    // console.log(slackIdentities);
    // return slackIdentities;
  }

  getIdentities = () => {
    const endpoint = '/users/me/identities/';
    const stateKey = 'identities';
    this.api.request(endpoint, {
      method: 'GET',
      // query,
      success: (data, _, jqXHR) => {
        const slackIdentities = this.getSlackIdentities(data);
        return slackIdentities;
        // this.handleRequestSuccess({stateKey, data, jqXHR}, true);
      },
      error: error => {
        this.handleError(error, [stateKey, endpoint, null, null]);
      },
    });
    // return slackIdentities? | [];
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;

    const query = {type: notificationType};
    return [['notificationSettings', `/users/me/notification-settings/`, {query}]];
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
    return initialData;
  }

  getFields(): FieldObject[] {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const fields = [
      Object.assign({}, NOTIFICATION_SETTING_FIELDS[notificationType], {
        help: t('This is the default for all projects.'),
        getData: data => this.getStateToPutForDefault(data),
      }),
    ];
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
    return fields as FieldObject[];
  }

  renderBody() {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;
    const identities = this.getIdentities();
    console.log({identities});
    // const temp = unlinkedSlacks(notificationType, notificationSettings, identities);
    // console.log(temp);

    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];

    return (
      <React.Fragment>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        <UnlinkedAlert />
        <FeedbackAlert />
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
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
            />
          ) : (
            <NotificationSettingsByOrganization
              notificationType={notificationType}
              notificationSettings={notificationSettings}
              onChange={this.getStateToPutForParent}
            />
          ))}
      </React.Fragment>
    );
  }
}

export default NotificationSettingsByType;
