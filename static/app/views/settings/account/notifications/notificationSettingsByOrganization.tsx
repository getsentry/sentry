import {Component} from 'react';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
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

type Props = {
  notificationSettings: NotificationSettingsObject;
  notificationType: string;
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject;
  onSubmitSuccess: () => void;
  organizations: OrganizationSummary[];
};

type State = {};

class NotificationSettingsByOrganization extends Component<Props, State> {
  render() {
    const {
      notificationType,
      notificationSettings,
      onChange,
      onSubmitSuccess,
      organizations,
    } = this.props;

    return (
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint="/users/me/notification-settings/"
        initialData={getParentData(notificationType, notificationSettings, organizations)}
        onSubmitSuccess={onSubmitSuccess}
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
