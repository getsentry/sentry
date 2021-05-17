import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import {t} from 'app/locale';
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
  notificationSettings: {
    [key: string]: {[key: string]: {[key: string]: {[key: string]: string}}};
  };
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

  isGroupedByProject() {
    /** We can infer the parent type by the `notificationType` key. */
    const {notificationType} = this.props;
    return isGroupedByProject(notificationType);
  }

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

  getParentData = (): {[key: string]: string} => {
    return Object.fromEntries(
      this.getParents().map(parent => [
        parent.id,
        Object.values(this.getParentValues(parent.id))[0],
      ])
    );
  };

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
                  fallbackValue
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

    this.setState({notificationSettings: updatedNotificationSettings});

    return updatedNotificationSettings;
  };

  getParentValues = (parentId: string): {[key: string]: string} => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const parentKey = this.isGroupedByProject() ? 'project' : 'organization';

    return (
      notificationSettings[notificationType]?.[parentKey]?.[parentId] || {
        email: 'default',
      }
    );
  };

  getStateToPutForDefault = (changedData: {[key: string]: string}) => {
    /** This always updates "user:me". */
    const {notificationType} = this.props;

    const newValue = Object.values(changedData)[0];
    const previousData = this.getUserDefaultValues();

    const notificationSettings = {
      [notificationType]: {
        user: {
          me: Object.fromEntries(
            Object.keys(previousData).map(provider => [provider, newValue])
          ),
        },
      },
    };

    this.setState({notificationSettings});

    return notificationSettings;
  };

  getStateToPutForParent = (changedData: {[key: string]: string}, parentId: string) => {
    /** Get the diff of the Notification Settings for this parent ID. */
    const {notificationType} = this.props;

    const parentKey = this.isGroupedByProject() ? 'project' : 'organization';
    const newValue = Object.values(changedData)[0];
    const previousData = this.getParentValues(parentId);

    const notificationSettings = {
      [notificationType]: {
        [parentKey]: {
          [parentId]: Object.fromEntries(
            Object.entries(previousData).map(([provider, _]) => [provider, newValue])
          ),
        },
      },
    };
    this.setState({notificationSettings});
    return notificationSettings;
  };

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
        <React.Fragment>
          <Avatar
            {...{[this.isGroupedByProject() ? 'project' : 'organization']: parent}}
          />
          {parent.slug}
        </React.Fragment>
      ),
      getData: data => this.getStateToPutForParent(data, parent.id),
      name: parent.id,
      choices: defaultFields.choices?.concat([
        [
          'default',
          `${getChoiceString(defaultFields.choices, currentDefault)} (${t('default')})`,
        ],
      ]),
      defaultValue: 'default',
    }) as any;
  };

  getDefaultSettings = (): [string, FieldObject[]] => {
    const {notificationType} = this.props;

    const title = this.isGroupedByProject() ? t('All Projects') : t('All Organizations');
    const fields = [
      Object.assign(
        {
          help: t('This is the default for all projects.'),
          getData: data => this.getStateToPutForDefault(data),
        },
        NOTIFICATION_SETTING_FIELDS[notificationType]
      ),
      Object.assign(
        {
          help: t('Where personal notifications will be sent.'),
          getData: data => this.getStateToPutForProvider(data),
        },
        NOTIFICATION_SETTING_FIELDS.provider
      ),
    ] as FieldObject[];
    return [title, fields];
  };

  renderBody() {
    const {notificationType} = this.props;

    const {title, description} = ACCOUNT_NOTIFICATION_FIELDS[notificationType];
    const groupedParents = this.getGroupedParents();
    const userData = this.getUserDefaultValues();
    const parentData = this.getParentData();
    const [formTitle, fields] = this.getDefaultSettings();

    return (
      <React.Fragment>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={{
            [notificationType]: Object.values(userData)[0],
            provider: providerListToString(Object.keys(userData)),
          }}
        >
          <JsonForm title={formTitle} fields={fields} />
        </Form>
        <Form
          saveOnBlur
          apiMethod="PUT"
          apiEndpoint="/users/me/notification-settings/"
          initialData={parentData}
        >
          {Object.entries(groupedParents).map(([groupTitle, parents]) => (
            <JsonForm
              key={groupTitle}
              title={groupTitle}
              fields={parents.map(parent => this.getParentField(parent))}
            />
          ))}
        </Form>
      </React.Fragment>
    );
  }
}

export default withOrganizations(NotificationSettings);
