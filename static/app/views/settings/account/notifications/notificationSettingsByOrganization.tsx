import React from 'react';

import {t} from 'sentry/locale';
import {OrganizationSummary} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'sentry/views/settings/account/notifications/constants';
import {
  getParentData,
  getParentField,
} from 'sentry/views/settings/account/notifications/utils';
import Form from 'sentry/views/settings/components/forms/form';
import JsonForm from 'sentry/views/settings/components/forms/jsonForm';

type Props = {
  notificationType: string;
  notificationSettings: NotificationSettingsObject;
  organizations: OrganizationSummary[];
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject;
};

type State = {};

class NotificationSettingsByOrganization extends React.Component<Props, State> {
  render() {
    const {notificationType, notificationSettings, onChange, organizations} = this.props;

    return (
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint="/users/me/notification-settings/"
        initialData={getParentData(notificationType, notificationSettings, organizations)}
      >
        <JsonForm
          title={t('Organizations')}
          fields={organizations.map(organization =>
            getParentField(notificationType, notificationSettings, organization, onChange)
          )}
        />
      </Form>
    );
  }
}

export default withOrganizations(NotificationSettingsByOrganization);
