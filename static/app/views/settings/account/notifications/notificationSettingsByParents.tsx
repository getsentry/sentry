import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import Avatar from 'app/components/avatar';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {OrganizationSummary, Project} from 'app/types';
import withOrganizations from 'app/utils/withOrganizations';
import {NOTIFICATION_SETTING_FIELDS} from 'app/views/settings/account/notifications/fields2';
import {
  getChoiceString,
  getCurrentDefault,
  getCurrentProviders,
  getParentKey,
  groupByOrganization,
  isEverythingDisabled,
  isGroupedByProject,
  NotificationSettingsByProviderObject,
  NotificationSettingsObject,
} from 'app/views/settings/account/notifications/utils';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {FieldObject} from 'app/views/settings/components/forms/type';

type Props = {
  notificationType: string;
  notificationSettings: NotificationSettingsObject;
  organizations: OrganizationSummary[];
  onChange: (
    changedData: NotificationSettingsByProviderObject,
    parentId: string
  ) => NotificationSettingsObject;
} & AsyncComponent['props'];

type State = {
  projects: Project[];
} & AsyncComponent['state'];

class NotificationSettingsByParents extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      projects: [],
    };
  }

  // TODO MARCOS split this whole file into notificationSettingsByProject and
  //  notificationSettingsByOrganization
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {notificationType} = this.props;

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [];
    if (isGroupedByProject(notificationType)) {
      endpoints.push(['projects', '/projects/']);
    }
    return endpoints;
  }

  getParentField = (parent: OrganizationSummary | Project): FieldObject => {
    /** Render each parent and add a default option to the the field choices. */
    const {notificationType, notificationSettings, onChange} = this.props;

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
      getData: data => onChange(data, parent.id),
      name: parent.id,
      choices: defaultFields.choices?.concat([
        [
          'default',
          `${t('Default')} (${getChoiceString(
            defaultFields.choices,
            getCurrentDefault(notificationType, notificationSettings)
          )})`,
        ],
      ]),
      defaultValue: 'default',
      help: undefined,
    }) as any;
  };

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

  getParents(): OrganizationSummary[] | Project[] {
    /** Use the `notificationType` key to decide which parent objects to use. */
    const {notificationType, organizations} = this.props;
    const {projects} = this.state;

    return isGroupedByProject(notificationType) ? projects : organizations;
  }

  getParentValues = (parentId: string): NotificationSettingsByProviderObject => {
    const {notificationType, notificationSettings} = this.props;

    return (
      notificationSettings[notificationType]?.[getParentKey(notificationType)]?.[
        parentId
      ] || {
        email: 'default',
      }
    );
  };

  getParentData = (): NotificationSettingsByProviderObject => {
    /** Get a mapping of all parent IDs to the notification setting for the current providers. */
    const {notificationType, notificationSettings} = this.props;

    const provider = getCurrentProviders(notificationType, notificationSettings)[0];

    return Object.fromEntries(
      this.getParents().map(parent => [
        parent.id,
        this.getParentValues(parent.id)[provider],
      ])
    );
  };

  renderBody() {
    const {notificationType, notificationSettings} = this.props;

    if (isEverythingDisabled(notificationType, notificationSettings)) {
      return <React.Fragment />;
    }

    const groupedParents = this.getGroupedParents();

    return (
      <Form
        saveOnBlur
        apiMethod="PUT"
        apiEndpoint="/users/me/notification-settings/"
        initialData={this.getParentData()}
      >
        {Object.entries(groupedParents).map(([groupTitle, parents]) => (
          <JsonForm
            key={groupTitle}
            title={groupTitle}
            fields={parents.map(parent => this.getParentField(parent))}
          />
        ))}
      </Form>
    );
  }
}

const FieldLabel = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  line-height: 16px;
`;

export default withOrganizations(NotificationSettingsByParents);
