import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import ProjectActions from 'app/actions/projectActions';
import Feature from 'app/components/acl/feature';
import ExternalLink from 'app/components/links/externalLink';
import {fields} from 'app/data/forms/projectIssueGrouping';
import {t, tct} from 'app/locale';
import {EventGroupingConfig, Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';

import UpgradeGrouping from './upgradeGrouping';

type Props = RouteComponentProps<{orgId: string; projectId: string}, {}> & {
  organization: Organization;
  project: Project;
};

type State = {
  groupingConfigs: EventGroupingConfig[] | null;
} & AsyncView['state'];

class ProjectDebugSymbols extends AsyncView<Props, State> {
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
    return [['groupingConfigs', '/grouping-configs/']];
  }

  handleSubmit = (response: Project) => {
    // This will update our project context
    ProjectActions.updateSuccess(response);
  };

  renderBody() {
    const {groupingConfigs} = this.state;
    const {organization, project, params} = this.props;
    const {orgId, projectId} = params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
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

          <UpgradeGrouping
            groupingConfigs={groupingConfigs ?? []}
            organization={organization}
            projectId={params.projectId}
            project={project}
            api={this.api}
            onUpgrade={this.fetchData}
          />
        </Form>
      </Fragment>
    );
  }
}

export default ProjectDebugSymbols;
