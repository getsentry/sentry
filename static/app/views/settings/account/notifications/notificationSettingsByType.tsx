import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary, Project} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import FeedbackAlert from 'app/views/settings/account/notifications/feedbackAlert';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'app/views/settings/account/notifications/fields';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import {
  getChoiceString,
  getParentIds,
  getParentKey,
  getStateToPutForDefault,
  getStateToPutForParent,
  getStateToPutForProvider,
  getUserDefaultValues,
  groupByOrganization,
  isGroupedByProject,
  mergeNotificationSettings,
  NotificationSettingsObject,
  providerListToString,
} from 'app/views/settings/account/notifications/utils';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {FieldObject} from 'app/views/settings/components/forms/type';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

type Props = {
  notificationType: string;
  organizations: OrganizationSummary[];
} & AsyncComponent['props'];

type State = {
  notificationSettings: NotificationSettingsObject;
  projects: Project[];
} & AsyncComponent['state'];

class NotificationSettingsByType extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      notificationSettings: {},
      projects: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;

    const query = {type: notificationType};
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      ['notificationSettings', `/users/me/notification-settings/`, {query}],
    ];
    if (this.isGroupedByProject()) {
      endpoints.push(['projects', '/projects/']);
    }
    return endpoints;
  }

  /* Helper methods that help interpret state. */

  isGroupedByProject() {
    /** We can infer the parent type by the `notificationType` key. */
    const {notificationType} = this.props;
    return isGroupedByProject(notificationType);
  }

  getParentKey = (): string => {
    const {notificationType} = this.props;
    return getParentKey(notificationType);
  };

  getParents(): OrganizationSummary[] | Project[] {
    /** Use the `notificationType` key to decide which parent objects to use. */
    const {organizations} = this.props;
    const {projects} = this.state;

    return this.isGroupedByProject() ? projects : organizations;
  }

  getParentIds(): string[] {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return getParentIds(notificationType, notificationSettings);
  }

  getUserDefaultValues = (): {[key: string]: string} => {
    /**
     * Get the mapping of providers to values that describe a user's parent-
     * independent notification preferences. The data from the API uses the user
     * ID rather than "me" so we assume the first ID is the user's.
     */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return getUserDefaultValues(notificationType, notificationSettings);
  };

  getParentValues = (parentId: string): {[key: string]: string} => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return (
      notificationSettings[notificationType]?.[this.getParentKey()]?.[parentId] || {
        email: 'default',
      }
    );
  };

  getParentData = (): {[key: string]: string} => {
    /** Get a mapping of all parent IDs to the notification setting for the current providers. */
    const provider = this.getCurrentProviders()[0];

    return Object.fromEntries(
      this.getParents().map(parent => [
        parent.id,
        this.getParentValues(parent.id)[provider],
      ])
    );
  };

  getCurrentProviders = (): string[] => {
    /** Get the list of providers currently active on this page. Note: this can be empty. */
    const userData = this.getUserDefaultValues();

    return Object.entries(userData)
      .filter(([_, value]) => !['never'].includes(value))
      .map(([provider, _]) => provider);
  };

  /* Methods responsible for updating state and hitting the API. */

  getStateToPutForProvider = changedData => {
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

  getStateToPutForDefault = (changedData: {[key: string]: string}) => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const updatedNotificationSettings = getStateToPutForDefault(
      notificationType,
      notificationSettings,
      changedData,
      this.getParentIds()
    );

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForParent = (changedData: {[key: string]: string}, parentId: string) => {
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

  getGroupedParents = (): {[key: string]: OrganizationSummary[] | Project[]} => {
    /**
     * The UI expects projects to be grouped by organization but can also use
     * this function to make a single group with all organizations.
     */
    const {organizations} = this.props;
    const {projects: stateProjects} = this.state;

    return this.isGroupedByProject()
      ? Object.fromEntries(
          Object.values(
            groupByOrganization(stateProjects)
          ).map(({organization, projects}) => [`${organization.name} Projects`, projects])
        )
      : {organizations};
  };

  getParentField = (parent: OrganizationSummary | Project): FieldObject => {
    const {notificationType} = this.props;

    const defaultFields = NOTIFICATION_SETTING_FIELDS[notificationType];
    const currentDefault = Object.values(this.getUserDefaultValues())[0];

    return Object.assign({}, defaultFields, {
      label: (
        <FieldLabel>
          <Avatar
            {...{[this.isGroupedByProject() ? 'project' : 'organization']: parent}}
          />
          <span>{parent.slug}</span>
        </FieldLabel>
      ),
      getData: data => this.getStateToPutForParent(data, parent.id),
      name: parent.id,
      choices: defaultFields.choices?.concat([
        [
          'default',
          `${t('Default')} (${getChoiceString(defaultFields.choices, currentDefault)})`,
        ],
      ]),
      defaultValue: 'default',
      help: undefined,
    }) as any;
  };

  getInitialData(): {[key: string]: string} {
    const {notificationType} = this.props;

    const providerList = this.getCurrentProviders();
    const initialData = {
      [notificationType]: providerList.length
        ? this.getUserDefaultValues()[providerList[0]]
        : 'never',
    };

    if (!this.isEverythingDisabled()) {
      initialData.provider = providerListToString(providerList);
    }
    return initialData;
  }

  getFields(): FieldObject[] {
    const {notificationType} = this.props;

    const fields = [
      Object.assign({}, NOTIFICATION_SETTING_FIELDS[notificationType], {
        help: t('This is the default for all projects.'),
        getData: data => this.getStateToPutForDefault(data),
      }),
    ];
    if (!this.isEverythingDisabled()) {
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

  isEverythingDisabled = (): boolean => {
    /**
     * For a given notificationType, are the parent-independent setting "never"
     * for all providers and are the parent-specific settings "default" or
     * "never". If so, the API is telling us that the user has opted out of
     * all notifications.
     */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return (
      // For user, all providers are "never".
      Object.values(this.getUserDefaultValues()).every(value => value === 'never') &&
      // Every leaf value is either "never" or "default".
      Object.values(
        notificationSettings[notificationType]?.[this.getParentKey()] || {}
      ).every(settingsByProvider =>
        Object.values(settingsByProvider).every(value =>
          ['never', 'default'].includes(value)
        )
      )
    );
  };

  renderBody() {
    const {notificationType} = this.props;
    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];

    return (
      <React.Fragment>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        <FeedbackAlert />
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={this.getInitialData()}
        >
          <JsonForm
            title={this.isGroupedByProject() ? t('All Projects') : t('All Organizations')}
            fields={this.getFields()}
          />
        </Form>
        {!this.isEverythingDisabled() && (
          <Form
            saveOnBlur
            apiMethod="PUT"
            apiEndpoint="/users/me/notification-settings/"
            initialData={this.getParentData()}
          >
            {Object.entries(this.getGroupedParents()).map(([groupTitle, parents]) => (
              <JsonForm
                key={groupTitle}
                title={groupTitle}
                fields={parents.map(parent => this.getParentField(parent))}
              />
            ))}
          </Form>
        )}
      </React.Fragment>
    );
  }
}

const FieldLabel = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  line-height: 16px;
`;

export default withOrganizations(NotificationSettingsByType);
