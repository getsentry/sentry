import React from 'react';
import {RouteComponentProps} from 'react-router';

import {openEditOwnershipRules} from 'app/actionCreators/modal';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import {t, tct} from 'app/locale';
import {Organization, Project} from 'app/types';
import routeTitleGen from 'app/utils/routeTitle';
import AsyncView from 'app/views/asyncView';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import CodeOwners from 'app/views/settings/project/projectOwnership/codeowners';
import RulesPanel from 'app/views/settings/project/projectOwnership/rulesPanel';

type Props = {
  organization: Organization;
  project: Project;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

type State = {
  ownership: null | any;
} & AsyncView['state'];

class ProjectOwnership extends AsyncView<Props, State> {
  getTitle() {
    const {project} = this.props;
    return routeTitleGen(t('Issue Owners'), project.slug, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, project} = this.props;
    return [['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`]];
  }

  getPlaceholder() {
    return `#example usage
path:src/example/pipeline/* person@sentry.io #infra
url:http://example.com/settings/* #product
tags.sku_class:enterprise #enterprise`;
  }

  getDetail() {
    return tct(
      `Automatically assign issues and send alerts to the right people based on issue properties. [link:Learn more].`,
      {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
        ),
      }
    );
  }

  handleOwnershipSave = (text: string | null) => {
    this.setState(prevState => ({
      ownership: {
        ...prevState.ownership,
        raw: text,
      },
    }));
  };

  renderBody() {
    const {project, organization} = this.props;
    const {ownership} = this.state;

    const disabled = !organization.access.includes('project:write');

    return (
      <React.Fragment>
        <SettingsPageHeader
          title={t('Issue Owners')}
          action={
            <Button
              to={{
                pathname: `/organizations/${organization.slug}/issues/`,
                query: {project: project.id},
              }}
              size="small"
            >
              {t('View Issues')}
            </Button>
          }
        />
        <PermissionAlert />
        <RulesPanel
          data-test-id="issueowners-panel"
          type="issueowners"
          raw={ownership.raw || ''}
          dateUpdated={ownership.lastUpdated}
          placeholder={this.getPlaceholder()}
          detail={this.getDetail()}
          controls={[
            <Button
              key="edit"
              size="small"
              onClick={() =>
                openEditOwnershipRules({
                  organization,
                  project,
                  ownership,
                  onSave: this.handleOwnershipSave,
                })
              }
              disabled={disabled}
            >
              {t('Edit')}
            </Button>,
          ]}
        />
        <Feature features={['import-codeowners']}>
          <CodeOwners {...this.props} />
        </Feature>
        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{fallthrough: ownership.fallthrough}}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: t('If ownership cannot be determined for an issue...'),
                fields: [
                  {
                    name: 'fallthrough',
                    type: 'boolean',
                    label: t('All users with access to this project are issue owners'),
                    help: t(
                      'Issue owners will receive notifications for issues they are responsible for.'
                    ),
                    disabled,
                  },
                ],
              },
            ]}
          />
        </Form>

        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{autoAssignment: ownership.autoAssignment}}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: t('If a new event matches any of the ownership rules...'),
                fields: [
                  {
                    name: 'autoAssignment',
                    type: 'boolean',
                    label: t('The issue is assigned to the team or user'),
                    help: t('Issue owners will be automatically assigned.'),
                    disabled,
                  },
                ],
              },
            ]}
          />
        </Form>
      </React.Fragment>
    );
  }
}

export default ProjectOwnership;
