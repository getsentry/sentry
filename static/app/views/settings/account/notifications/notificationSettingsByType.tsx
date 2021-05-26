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
  isEverythingDisabled,
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
    if (isGroupedByProject(notificationType)) {
      endpoints.push(['projects', '/projects/']);
    }
    return endpoints;
  }

  /* Helper methods that help interpret state. */

  getParents(): OrganizationSummary[] | Project[] {
    /** Use the `notificationType` key to decide which parent objects to use. */
    const {notificationType, organizations} = this.props;
    const {projects} = this.state;

    return isGroupedByProject(notificationType) ? projects : organizations;
  }

  getParentValues = (parentId: string): {[key: string]: string} => {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return (
      notificationSettings[notificationType]?.[getParentKey(notificationType)]?.[
        parentId
      ] || {
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
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    return Object.entries(getUserDefaultValues(notificationType, notificationSettings))
      .filter(([_, value]) => !['never'].includes(value))
      .map(([provider, _]) => provider);
  };

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

  getGroupedParents = (): {[key: string]: OrganizationSummary[] | Project[]} => {
    /**
     * The UI expects projects to be grouped by organization but can also use
     * this function to make a single group with all organizations.
     */
    const {notificationType, organizations} = this.props;
    const {projects: stateProjects} = this.state;

    return isGroupedByProject(notificationType)
      ? Object.fromEntries(
          Object.values(
            groupByOrganization(stateProjects)
          ).map(({organization, projects}) => [`${organization.name} Projects`, projects])
        )
      : {organizations};
  };

  getCurrentDefault = (): string => {
    /** Calculate the currently selected provider. */
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const providersList = this.getCurrentProviders();
    return providersList.length
      ? getUserDefaultValues(notificationType, notificationSettings)[providersList[0]]
      : 'never';
  };

  getParentField = (parent: OrganizationSummary | Project): FieldObject => {
    /** Render each parent and add a default option to the the field choices. */
    const {notificationType} = this.props;

    const defaultFields = NOTIFICATION_SETTING_FIELDS[notificationType];

    return Object.assign({}, defaultFields, {
      label: (
        <FieldLabel>
          <Avatar
            {...{
              [isGroupedByProject(notificationType) ? 'project' : 'organization']: parent,
            }}
          />
          <span>{parent.slug}</span>
        </FieldLabel>
      ),
      getData: data => this.getStateToPutForParent(data, parent.id),
      name: parent.id,
      choices: defaultFields.choices?.concat([
        [
          'default',
          `${t('Default')} (${getChoiceString(
            defaultFields.choices,
            this.getCurrentDefault()
          )})`,
        ],
      ]),
      defaultValue: 'default',
      help: undefined,
    }) as any;
  };

  getInitialData(): {[key: string]: string} {
    const {notificationType} = this.props;
    const {notificationSettings} = this.state;

    const initialData = {[notificationType]: this.getCurrentDefault()};
    if (!isEverythingDisabled(notificationType, notificationSettings)) {
      initialData.provider = providerListToString(this.getCurrentProviders());
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
            title={
              isGroupedByProject(notificationType)
                ? t('All Projects')
                : t('All Organizations')
            }
            fields={this.getFields()}
          />
        </Form>
        {!isEverythingDisabled(notificationType, notificationSettings) && (
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
