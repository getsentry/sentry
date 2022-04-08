import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import SelectField from 'sentry/components/forms/selectField';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {fields} from 'sentry/data/forms/accountNotificationSettings';
import {t} from 'sentry/locale';
import {Organization, Project, UserEmail} from 'sentry/types';
import withOrganizations from 'sentry/utils/withOrganizations';
import AsyncView from 'sentry/views/asyncView';
import {
  ACCOUNT_NOTIFICATION_FIELDS,
  FineTuneField,
} from 'sentry/views/settings/account/notifications/fields';
import NotificationSettingsByType from 'sentry/views/settings/account/notifications/notificationSettingsByType';
import {
  groupByOrganization,
  isGroupedByProject,
} from 'sentry/views/settings/account/notifications/utils';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

const PanelBodyLineItem = styled(PanelBody)`
  font-size: 1rem;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

type ANBPProps = {
  field: FineTuneField;
  projects: Project[];
};

const AccountNotificationsByProject = ({projects, field}: ANBPProps) => {
  const projectsByOrg = groupByOrganization(projects);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {title, description, ...fieldConfig} = field;

  // Display as select box in this view regardless of the type specified in the config
  const data = Object.values(projectsByOrg).map(org => ({
    name: org.organization.name,
    projects: org.projects.map(project => ({
      ...fieldConfig,
      // `name` key refers to field name
      // we use project.id because slugs are not unique across orgs
      name: project.id,
      label: project.slug,
    })),
  }));

  return (
    <Fragment>
      {data.map(({name, projects: projectFields}) => (
        <div key={name}>
          <PanelHeader>{name}</PanelHeader>
          {projectFields.map(f => (
            <PanelBodyLineItem key={f.name}>
              <SelectField
                defaultValue={f.defaultValue}
                name={f.name}
                options={f.options}
                label={f.label}
              />
            </PanelBodyLineItem>
          ))}
        </div>
      ))}
    </Fragment>
  );
};

type ANBOProps = {
  field: FineTuneField;
  organizations: Organization[];
};

const AccountNotificationsByOrganization = ({organizations, field}: ANBOProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const {title, description, ...fieldConfig} = field;

  // Display as select box in this view regardless of the type specified in the config
  const data = organizations.map(org => ({
    ...fieldConfig,
    // `name` key refers to field name
    // we use org.id to remain consistent project.id use (which is required because slugs are not unique across orgs)
    name: org.id,
    label: org.slug,
  }));

  return (
    <Fragment>
      {data.map(f => (
        <PanelBodyLineItem key={f.name}>
          <SelectField
            defaultValue={f.defaultValue}
            name={f.name}
            options={f.options}
            label={f.label}
          />
        </PanelBodyLineItem>
      ))}
    </Fragment>
  );
};

const AccountNotificationsByOrganizationContainer = withOrganizations(
  AccountNotificationsByOrganization
);

type Props = AsyncView['props'] &
  RouteComponentProps<{fineTuneType: string}, {}> & {
    organizations: Organization[];
  };

type State = AsyncView['state'] & {
  emails: UserEmail[] | null;
  fineTuneData: Record<string, any> | null;
  notifications: Record<string, any> | null;
  projects: Project[] | null;
};

class AccountNotificationFineTuning extends AsyncView<Props, State> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {fineTuneType} = this.props.params;
    const endpoints = [
      ['notifications', '/users/me/notifications/'],
      ['fineTuneData', `/users/me/notifications/${fineTuneType}/`],
    ];

    if (isGroupedByProject(fineTuneType)) {
      endpoints.push(['projects', '/projects/']);
    }

    endpoints.push(['emails', '/users/me/emails/']);
    if (fineTuneType === 'email') {
      endpoints.push(['emails', '/users/me/emails/']);
    }

    return endpoints as ReturnType<AsyncView['getEndpoints']>;
  }

  // Return a sorted list of user's verified emails
  get emailChoices() {
    return (
      this.state.emails
        ?.filter(({isVerified}) => isVerified)
        ?.sort((a, b) => {
          // Sort by primary -> email
          if (a.isPrimary) {
            return -1;
          }
          if (b.isPrimary) {
            return 1;
          }

          return a.email < b.email ? -1 : 1;
        }) ?? []
    );
  }

  renderBody() {
    const {params} = this.props;
    const {fineTuneType} = params;

    if (['alerts', 'deploy', 'workflow', 'approval', 'quota'].includes(fineTuneType)) {
      return <NotificationSettingsByType notificationType={fineTuneType} />;
    }

    const {notifications, projects, fineTuneData, projectsPageLinks} = this.state;

    const isProject = isGroupedByProject(fineTuneType);
    const field = ACCOUNT_NOTIFICATION_FIELDS[fineTuneType];
    const {title, description} = field;

    const [stateKey, url] = isProject ? this.getEndpoints()[2] : [];
    const hasProjects = !!projects?.length;

    if (fineTuneType === 'email') {
      // Fetch verified email addresses
      field.options = this.emailChoices.map(({email}) => ({value: email, label: email}));
    }

    if (!notifications || !fineTuneData) {
      return null;
    }

    return (
      <div>
        <SettingsPageHeader title={title} />
        {description && <TextBlock>{description}</TextBlock>}

        {field &&
          field.defaultFieldName &&
          // not implemented yet
          field.defaultFieldName !== 'weeklyReports' && (
            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint="/users/me/notifications/"
              initialData={notifications}
            >
              <JsonForm
                title={`Default ${title}`}
                fields={[fields[field.defaultFieldName]]}
              />
            </Form>
          )}
        <Panel>
          <PanelBody>
            <PanelHeader hasButtons={isProject}>
              <Heading>{isProject ? t('Projects') : t('Organizations')}</Heading>
              <div>
                {isProject &&
                  this.renderSearchInput({
                    placeholder: t('Search Projects'),
                    url,
                    stateKey,
                  })}
              </div>
            </PanelHeader>

            <Form
              saveOnBlur
              apiMethod="PUT"
              apiEndpoint={`/users/me/notifications/${fineTuneType}/`}
              initialData={fineTuneData}
            >
              {isProject && hasProjects && (
                <AccountNotificationsByProject projects={projects!} field={field} />
              )}

              {isProject && !hasProjects && (
                <EmptyMessage>{t('No projects found')}</EmptyMessage>
              )}

              {!isProject && (
                <AccountNotificationsByOrganizationContainer field={field} />
              )}
            </Form>
          </PanelBody>
        </Panel>

        {projects && <Pagination pageLinks={projectsPageLinks} {...this.props} />}
      </div>
    );
  }
}

const Heading = styled('div')`
  flex: 1;
`;

export default AccountNotificationFineTuning;
