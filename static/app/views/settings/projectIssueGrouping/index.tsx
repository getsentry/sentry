import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import Feature from 'sentry/components/acl/feature';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import {fields} from 'sentry/data/forms/projectIssueGrouping';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventGroupingConfig, Organization, Project} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

import UpgradeGrouping from './upgradeGrouping';

type Props = RouteComponentProps<{projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = {
  groupingConfigs: EventGroupingConfig[] | null;
} & AsyncView['state'];

class ProjectIssueGrouping extends AsyncView<Props, State> {
  getTitle() {
    const {projectId} = this.props.params;

    return routeTitleGen(t('Issue Grouping'), projectId, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      groupingConfigs: [],
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [
      [
        'groupingConfigs',
        `/projects/${organization.slug}/${project.slug}/grouping-configs/`,
      ],
    ];
  }

  handleSubmit = (response: Project) => {
    // This will update our project context
    ProjectsStore.onUpdateSuccess(response);
  };

  renderBody() {
    const {groupingConfigs} = this.state;
    const {organization, project, params, location} = this.props;
    const endpoint = `/projects/${organization.slug}/${project.slug}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization,
        groupingConfigs,
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write'),
    };

    return (
      <Fragment>
        <SettingsPageHeader title={t('Issue Grouping')} />

        <TextBlock>
          {tct(
            `All events have a fingerprint. Events with the same fingerprint are grouped together into an issue. To learn more about issue grouping, [link: read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/data-management-settings/event-grouping/" />
              ),
            }
          )}
        </TextBlock>

        <Form
          saveOnBlur
          allowUndo
          initialData={project}
          apiMethod="PUT"
          apiEndpoint={endpoint}
          onSubmitSuccess={this.handleSubmit}
        >
          <JsonForm
            {...jsonFormProps}
            title={t('Fingerprint Rules')}
            fields={[fields.fingerprintingRules]}
          />

          <JsonForm
            {...jsonFormProps}
            title={t('Stack Trace Rules')}
            fields={[fields.groupingEnhancements]}
          />

          <Feature features={['set-grouping-config']} organization={organization}>
            <JsonForm
              {...jsonFormProps}
              title={t('Change defaults')}
              fields={[
                fields.groupingConfig,
                fields.secondaryGroupingConfig,
                fields.secondaryGroupingExpiry,
              ]}
            />
          </Feature>

          <JsonForm
            {...jsonFormProps}
            title={t('Automatic Grouping Updates')}
            fields={[fields.groupingAutoUpdate]}
          />

          <UpgradeGrouping
            groupingConfigs={groupingConfigs ?? []}
            organization={organization}
            projectId={params.projectId}
            project={project}
            api={this.api}
            onUpgrade={this.fetchData}
            location={location}
          />
        </Form>
      </Fragment>
    );
  }
}

export default ProjectIssueGrouping;
