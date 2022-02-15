import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'sentry/actionCreators/projects';
import ProjectActions from 'sentry/actions/projectActions';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Field from 'sentry/components/forms/field';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {FieldValue} from 'sentry/components/forms/model';
import TextField from 'sentry/components/forms/textField';
import {removePageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import {Panel, PanelAlert, PanelHeader} from 'sentry/components/panels';
import {fields} from 'sentry/data/forms/projectGeneralSettings';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import recreateRoute from 'sentry/utils/recreateRoute';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string; projectId: string}, {}> & {
    onChangeSlug: (slug: string) => void;
    organization: Organization;
  };

type State = AsyncView['state'] & {
  data: Project;
};

class ProjectGeneralSettings extends AsyncView<Props, State> {
  private _form: Record<string, FieldValue> = {};

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Project Settings'), projectId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {orgId, projectId} = this.props.params;

    return [['data', `/projects/${orgId}/${projectId}/`]];
  }

  handleTransferFieldChange = (id: string, value: FieldValue) => {
    this._form[id] = value;
  };

  handleRemoveProject = () => {
    const {orgId} = this.props.params;
    const project = this.state.data;

    removePageFiltersStorage(orgId);

    if (!project) {
      return;
    }

    removeProject(this.api, orgId, project).then(() => {
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    }, handleXhrErrorResponse('Unable to remove project'));
  };

  handleTransferProject = async () => {
    const {orgId} = this.props.params;
    const project = this.state.data;
    if (!project) {
      return;
    }
    if (typeof this._form.email !== 'string' || this._form.email.length < 1) {
      return;
    }

    try {
      await transferProject(this.api, orgId, project, this._form.email);
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    } catch (err) {
      if (err.status >= 500) {
        handleXhrErrorResponse('Unable to transfer project')(err);
      }
    }
  };

  isProjectAdmin = () => new Set(this.props.organization.access).has('project:admin');

  renderRemoveProject() {
    const project = this.state.data;
    const isProjectAdmin = this.isProjectAdmin();
    const {isInternal} = project;

    return (
      <Field
        label={t('Remove Project')}
        help={tct(
          'Remove the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isProjectAdmin &&
          t('You do not have the required permission to remove this project.')}

        {isInternal &&
          t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}

        {isProjectAdmin && !isInternal && (
          <Confirm
            onConfirm={this.handleRemoveProject}
            priority="danger"
            confirmText={t('Remove project')}
            message={
              <div>
                <TextBlock>
                  <strong>
                    {t('Removing this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t('This will also remove all associated event data.')}
                </TextBlock>
              </div>
            }
          >
            <div>
              <Button className="ref-remove-project" type="button" priority="danger">
                {t('Remove Project')}
              </Button>
            </div>
          </Confirm>
        )}
      </Field>
    );
  }

  renderTransferProject() {
    const project = this.state.data;
    const isProjectAdmin = this.isProjectAdmin();
    const {isInternal} = project;

    return (
      <Field
        label={t('Transfer Project')}
        help={tct(
          'Transfer the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isProjectAdmin &&
          t('You do not have the required permission to transfer this project.')}

        {isInternal &&
          t(
            'This project cannot be transferred. It is used internally by the Sentry server.'
          )}

        {isProjectAdmin && !isInternal && (
          <Confirm
            onConfirm={this.handleTransferProject}
            priority="danger"
            confirmText={t('Transfer project')}
            renderMessage={({confirm}) => (
              <div>
                <TextBlock>
                  <strong>
                    {t('Transferring this project is permanent and cannot be undone!')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t(
                    'Please enter the email of an organization owner to whom you would like to transfer this project.'
                  )}
                </TextBlock>
                <Panel>
                  <Form
                    hideFooter
                    onFieldChange={this.handleTransferFieldChange}
                    onSubmit={(_data, _onSuccess, _onError, e) => {
                      e.stopPropagation();
                      confirm();
                    }}
                  >
                    <TextField
                      name="email"
                      label={t('Organization Owner')}
                      placeholder="admin@example.com"
                      required
                      help={t(
                        'A request will be emailed to this address, asking the organization owner to accept the project transfer.'
                      )}
                    />
                  </Form>
                </Panel>
              </div>
            )}
          >
            <div>
              <Button className="ref-transfer-project" type="button" priority="danger">
                {t('Transfer Project')}
              </Button>
            </div>
          </Confirm>
        )}
      </Field>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const project = this.state.data;
    const {orgId, projectId} = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization,
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write'),
    };
    const team = project.teams.length ? project.teams?.[0] : undefined;

    return (
      <div>
        <SettingsPageHeader title={t('Project Settings')} />
        <PermissionAlert />

        <Form
          saveOnBlur
          allowUndo
          initialData={{
            ...project,
            team,
          }}
          apiMethod="PUT"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            this.setState({data: resp});
            if (projectId !== resp.slug) {
              changeProjectSlug(projectId, resp.slug);
              // Container will redirect after stores get updated with new slug
              this.props.onChangeSlug(resp.slug);
            }
            // This will update our project context
            ProjectActions.updateSuccess(resp);
          }}
        >
          <JsonForm
            {...jsonFormProps}
            title={t('Project Details')}
            fields={[fields.slug, fields.platform]}
          />

          <JsonForm
            {...jsonFormProps}
            title={t('Email')}
            fields={[fields.subjectPrefix]}
          />

          <JsonForm
            {...jsonFormProps}
            title={t('Event Settings')}
            fields={[fields.resolveAge]}
          />

          <JsonForm
            {...jsonFormProps}
            title={t('Client Security')}
            fields={[
              fields.allowedDomains,
              fields.scrapeJavaScript,
              fields.securityToken,
              fields.securityTokenHeader,
              fields.verifySSL,
            ]}
            renderHeader={() => (
              <PanelAlert type="info">
                <TextBlock noMargin>
                  {tct(
                    'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                    {
                      link: (
                        <a href="https://github.com/getsentry/sentry-javascript">
                          sentry-javascript
                        </a>
                      ),
                    }
                  )}{' '}
                  {tct(
                    'This will restrict requests based on the [Origin] and [Referer] headers.',
                    {
                      Origin: <code>Origin</code>,
                      Referer: <code>Referer</code>,
                    }
                  )}
                </TextBlock>
              </PanelAlert>
            )}
          />
        </Form>

        <Panel>
          <PanelHeader>{t('Project Administration')}</PanelHeader>
          {this.renderRemoveProject()}
          {this.renderTransferProject()}
        </Panel>
      </div>
    );
  }
}

type ContainerProps = {
  organization: Organization;
} & RouteComponentProps<{orgId: string; projectId: string}, {}>;

class ProjectGeneralSettingsContainer extends Component<ContainerProps> {
  componentWillUnmount() {
    this.unsubscribe();
  }

  changedSlug: string | undefined = undefined;
  unsubscribe = ProjectsStore.listen(() => this.onProjectsUpdate(), undefined);

  onProjectsUpdate() {
    if (!this.changedSlug) {
      return;
    }
    const project = ProjectsStore.getBySlug(this.changedSlug);

    if (!project) {
      return;
    }

    browserHistory.replace(
      recreateRoute('', {
        ...this.props,
        params: {
          ...this.props.params,
          projectId: this.changedSlug,
        },
      })
    );
  }

  render() {
    return (
      <ProjectGeneralSettings
        onChangeSlug={(newSlug: string) => (this.changedSlug = newSlug)}
        {...this.props}
      />
    );
  }
}

export default withOrganization(ProjectGeneralSettingsContainer);
