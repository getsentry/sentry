import {Fragment} from 'react';
import styled from '@emotion/styled';

import AlertLink from 'sentry/components/alertLink';
import AsyncComponent from 'sentry/components/asyncComponent';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import withOrganizations from 'sentry/utils/withOrganizations';
import {
  CONFIRMATION_MESSAGE,
  NOTIFICATION_SETTINGS_TYPES,
  NotificationSettingsObject,
  SELF_NOTIFICATION_SETTINGS_TYPES,
} from 'sentry/views/settings/account/notifications/constants';
import FeedbackAlert from 'sentry/views/settings/account/notifications/feedbackAlert';
import {NOTIFICATION_SETTING_FIELDS} from 'sentry/views/settings/account/notifications/fields2';
import {
  decideDefault,
  getParentIds,
  getStateToPutForDefault,
  isSufficientlyComplex,
  mergeNotificationSettings,
} from 'sentry/views/settings/account/notifications/utils';
import Form from 'sentry/views/settings/components/forms/form';
import JsonForm from 'sentry/views/settings/components/forms/jsonForm';
import {FieldObject} from 'sentry/views/settings/components/forms/type';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

type Props = AsyncComponent['props'] & {
  organizations: Organization[];
};

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

  componentDidMount() {
    // only tied to a user
    trackAdvancedAnalyticsEvent('notification_settings.index_page_viewed', {
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

  get notificationSettingsType() {
    const hasFeatureFlag =
      this.props.organizations.filter(org =>
        org.features?.includes('slack-overage-notifications')
      ).length > 0;
    // filter out quotas if the feature flag isn't set
    return NOTIFICATION_SETTINGS_TYPES.filter(type => type !== 'quota' || hasFeatureFlag);
  }

  getInitialData(): {[key: string]: string} {
    const {notificationSettings} = this.state;

    return Object.fromEntries(
      this.notificationSettingsType.map(notificationType => [
        notificationType,
        decideDefault(notificationType, notificationSettings),
      ])
    );
  }

  getFields(): FieldObject[] {
    const {notificationSettings} = this.state;

    const fields: FieldObject[] = [];
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
                to={`/settings/account/notifications/${notificationType}`}
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

      fields.push(field);
    }
    return fields;
  }

  renderBody() {
    const {legacyData} = this.state;

    return (
      <Fragment>
        <SettingsPageHeader title="Notifications" />
        <TextBlock>Personal notifications sent via email or an integration.</TextBlock>
        <FeedbackAlert />
        <StyledForm
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
        >
          <JsonForm title={t('Notifications')} fields={this.getFields()} />
        </StyledForm>
        <StyledLegacyForm
          initialData={legacyData}
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notifications/"
        >
          <JsonForm
            fields={SELF_NOTIFICATION_SETTINGS_TYPES.map(
              type => NOTIFICATION_SETTING_FIELDS[type] as FieldObject
            )}
          />
        </StyledLegacyForm>
        <AlertLink to="/settings/account/emails" icon={<IconMail />}>
          {t('Looking to add or remove an email address? Use the emails panel.')}
        </AlertLink>
      </Fragment>
    );
  }
}

export default withOrganizations(NotificationSettings);

const StyledForm = styled(Form)<Form['props']>`
  ${Panel} {
    margin-bottom: 0;
    border-bottom: 1px solid ${p => p.theme.innerBorder};
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

const StyledLegacyForm = styled(Form)<Form['props']>`
  ${Panel} {
    border-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
`;
