import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import {ACCOUNT_NOTIFICATION_FIELDS} from 'app/views/settings/account/notifications/fields';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import {
  backfillMissingProvidersWithFallback,
  getChoiceString,
  getFallBackValue,
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
  organizations: Organization[];
} & AsyncComponent['props'];

type State = {
  notificationSettings: NotificationSettingsObject;
  projects: Project[];
} & AsyncComponent['state'];

class NotificationSettings extends AsyncComponent<Props, State> {
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
    return this.isGroupedByProject() ? 'project' : 'organization';
  };

  getParents(): Organization[] | Project[] {
    /** Use the `notificationType` key to decide which parent objects to use */
    const {organizations} = this.props;
    const {projects} = this.state;

    return this.isGroupedByProject() ? projects : organizations;
  }

  getUserDefaultValues = (): {[key: string]: string} => {
    /**
     * Get the mapping of providers to values that describe a user's parent-
     * independent notification preferences. The data from the API uses the user
     * ID rather than "me" so we assume the first ID is the user's.
     */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return (
      Object.values(notificationSettings[notificationType]?.user || {}).pop() || {
        email: getFallBackValue(notificationType),
      }
    );
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
    /**
     * I don't need to update the provider for EVERY once of the user's projects
     * and organizations, just the user and parents that have explicit settings.
     */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const providerList: string[] = changedData.provider.split('+');
    const fallbackValue = getFallBackValue(notificationType);

    let updatedNotificationSettings;
    if (Object.keys(notificationSettings).length) {
      updatedNotificationSettings = {
        [notificationType]: Object.fromEntries(
          Object.entries(
            notificationSettings[notificationType]
          ).map(([scopeType, scopeTypeData]) => [
            scopeType,
            Object.fromEntries(
              Object.entries(scopeTypeData).map(([scopeId, scopeIdData]) => [
                scopeId,
                backfillMissingProvidersWithFallback(
                  scopeIdData,
                  providerList,
                  fallbackValue,
                  scopeType
                ),
              ])
            ),
          ])
        ),
      };
    } else {
      // If the user has no settings, we need to create them.
      updatedNotificationSettings = {
        [notificationType]: {
          user: {
            me: Object.fromEntries(
              providerList.map(provider => [provider, fallbackValue])
            ),
          },
        },
      };
    }

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForDefault = (changedData: {[key: string]: string}) => {
    /**
     * Update the current providers' parent-independent notification settings
     * with the new value. If the new value is "never", then also update all
     * parent-specific notification settings to "default". If the previous value
     * was "never", then assume providerList should be "email" only.
     */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const newValue = Object.values(changedData)[0];
    let providerList = this.getCurrentProviders();
    if (!providerList.length) {
      providerList = ['email'];
    }

    const updatedNotificationSettings = {
      [notificationType]: {
        user: {
          me: Object.fromEntries(providerList.map(provider => [provider, newValue])),
        },
      },
    };

    if (newValue === 'never') {
      updatedNotificationSettings[notificationType][
        this.getParentKey()
      ] = Object.fromEntries(
        this.getParents().map(parent => [
          parent.id,
          Object.fromEntries(providerList.map(provider => [provider, 'default'])),
        ])
      );
    }

    this.setState({
      notificationSettings: mergeNotificationSettings(
        notificationSettings,
        updatedNotificationSettings
      ),
    });

    return updatedNotificationSettings;
  };

  getStateToPutForParent = (changedData: {[key: string]: string}, parentId: string) => {
    /** Get the diff of the Notification Settings for this parent ID. */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const currentProviders = this.getCurrentProviders();
    const newValue = Object.values(changedData)[0];

    const updatedNotificationSettings = {
      [notificationType]: {
        [this.getParentKey()]: {
          [parentId]: Object.fromEntries(
            currentProviders.map(provider => [provider, newValue])
          ),
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

  /* Methods responsible for rendering the page. */

  getGroupedParents = (): {[key: string]: Organization[] | Project[]} => {
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

  getParentField = (parent: Organization | Project): FieldObject => {
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
      Object.assign(
        {
          help: t('This is the default for all projects.'),
          getData: data => this.getStateToPutForDefault(data),
        },
        NOTIFICATION_SETTING_FIELDS[notificationType]
      ),
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
export default withOrganizations(NotificationSettings);
