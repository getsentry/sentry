import {Component} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'sentry/actionCreators/projects';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import type {FieldValue} from 'sentry/components/forms/model';
import type {FieldObject} from 'sentry/components/forms/types';
import Hook from 'sentry/components/hook';
import ExternalLink from 'sentry/components/links/externalLink';
import {removePageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import Panel from 'sentry/components/panels/panel';
import PanelAlert from 'sentry/components/panels/panelAlert';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {fields} from 'sentry/data/forms/projectGeneralSettings';
import {t, tct} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {browserHistory} from 'sentry/utils/browserHistory';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import recreateRoute from 'sentry/utils/recreateRoute';
import type RequestError from 'sentry/utils/requestError/requestError';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

type Props = DeprecatedAsyncView['props'] &
  RouteComponentProps<{projectId: string}, {}> & {
    onChangeSlug: (slug: string) => void;
    organization: Organization;
  };

type State = DeprecatedAsyncView['state'] & {
  data: Project;
};

class ProjectGeneralSettings extends DeprecatedAsyncView<Props, State> {
  private _form: Record<string, FieldValue> = {};

  getTitle() {
    const {projectId} = this.props.params;
    return routeTitleGen(t('Project Settings'), projectId, false);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    const {projectId} = this.props.params;

    return [['data', `/projects/${organization.slug}/${projectId}/`]];
  }

  handleTransferFieldChange = (id: string, value: FieldValue) => {
    this._form[id] = value;
  };

  handleRemoveProject = () => {
    const {organization} = this.props;
    const project = this.state.data;

    removePageFiltersStorage(organization.slug);

    if (!project) {
      return;
    }

    removeProject({
      api: this.api,
      orgSlug: organization.slug,
      projectSlug: project.slug,
      origin: 'settings',
    })
      .then(
        () => {
          addSuccessMessage(
            tct('[project] was successfully removed', {project: project.slug})
          );
        },
        err => {
          addErrorMessage(tct('Error removing [project]', {project: project.slug}));
          throw err;
        }
      )
      .then(
        () => {
          // Need to hard reload because lots of components do not listen to Projects Store
          window.location.assign('/');
        },
        (err: RequestError) => handleXhrErrorResponse('Unable to remove project', err)
      );
  };

  handleTransferProject = async () => {
    const {organization} = this.props;
    const project = this.state.data;
    if (!project) {
      return;
    }
    if (typeof this._form.email !== 'string' || this._form.email.length < 1) {
      return;
    }

    try {
      await transferProject(this.api, organization.slug, project, this._form.email);
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    } catch (err) {
      if (err.status >= 500) {
        handleXhrErrorResponse('Unable to transfer project', err);
      }
    }
  };

  isProjectAdmin = () =>
    hasEveryAccess(['project:admin'], {
      organization: this.props.organization,
      project: this.state.data,
    });

  renderRemoveProject() {
    const project = this.state.data;
    const isProjectAdmin = this.isProjectAdmin();
    const {isInternal} = project;

    return (
      <FieldGroup
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
            confirmText={t('Remove Project')}
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
              <Button priority="danger">{t('Remove Project')}</Button>
            </div>
          </Confirm>
        )}
      </FieldGroup>
    );
  }

  renderTransferProject() {
    const project = this.state.data;
    const {isInternal} = project;
    const isOrgOwner = hasEveryAccess(['org:admin'], {
      organization: this.props.organization,
    });

    return (
      <FieldGroup
        label={t('Transfer Project')}
        help={tct(
          'Transfer the [project] project and all related data. [linebreak] Careful, this action cannot be undone.',
          {
            project: <strong>{project.slug}</strong>,
            linebreak: <br />,
          }
        )}
      >
        {!isOrgOwner &&
          t('You do not have the required permission to transfer this project.')}

        {isInternal &&
          t(
            'This project cannot be transferred. It is used internally by the Sentry server.'
          )}

        {isOrgOwner && !isInternal && (
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
                    'Please enter the email of an organization owner to whom you would like to transfer this project. Note: It is not possible to transfer projects between organizations in different regions.'
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
              <Button priority="danger">{t('Transfer Project')}</Button>
            </div>
          </Confirm>
        )}
      </FieldGroup>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const project = this.state.data;
    const {projectId} = this.props.params;
    const endpoint = `/projects/${organization.slug}/${projectId}/`;
    const access = new Set(organization.access.concat(project.access));

    const jsonFormProps = {
      additionalFieldProps: {
        organization,
      },
      features: new Set(organization.features),
      access,
      disabled: !hasEveryAccess(['project:write'], {organization, project}),
    };

    const team = project.teams.length ? project.teams?.[0] : undefined;

    // XXX: HACK
    //
    // The <Form /> component applies its props to its children meaning the
    // hooked component would need to conform to the form settings applied in a
    // separate repository. This is not feasible to maintain and may introduce
    // compatability errors if something changes in either repository. For that
    // reason, the Form component is split in two, since the fields do not
    // depend on one another, allowing for the Hook to manage its own state.
    const formProps: FormProps = {
      saveOnBlur: true,
      allowUndo: true,
      initialData: {
        ...project,
        team,
      },
      apiMethod: 'PUT' as const,
      apiEndpoint: endpoint,
      onSubmitSuccess: resp => {
        this.setState({data: resp});
        if (projectId !== resp.slug) {
          changeProjectSlug(projectId, resp.slug);
          // Container will redirect after stores get updated with new slug
          this.props.onChangeSlug(resp.slug);
        }
        // This will update our project context
        ProjectsStore.onUpdateSuccess(resp);
      },
    };

    const projectIdField: FieldObject = {
      name: 'projectId',
      type: 'string',
      disabled: true,
      label: t('Project ID'),
      setValue(_, _name) {
        return project.id;
      },
      help: `The unique identifier for this project. It cannot be modified.`,
    };

    return (
      <div>
        <SettingsPageHeader title={t('Project Settings')} />
        <PermissionAlert project={project} />
        <Form {...formProps}>
          <JsonForm
            {...jsonFormProps}
            title={t('Project Details')}
            fields={[fields.name!, projectIdField, fields.platform!]}
          />
          <JsonForm
            {...jsonFormProps}
            title={t('Email')}
            fields={[fields.subjectPrefix!]}
          />
        </Form>
        <Hook
          name="spend-visibility:spike-protection-project-settings"
          project={project}
        />
        <Form {...formProps}>
          <JsonForm
            {...jsonFormProps}
            title={t('Event Settings')}
            fields={[fields.resolveAge!]}
          />

          <JsonForm
            {...jsonFormProps}
            title={t('Client Security')}
            fields={[
              fields.allowedDomains!,
              fields.scrapeJavaScript!,
              fields.securityToken!,
              fields.securityTokenHeader!,
              fields.verifySSL!,
            ]}
            renderHeader={() => (
              <PanelAlert type="info">
                <TextBlock noMargin>
                  {tct(
                    'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                    {
                      link: (
                        <ExternalLink href="https://github.com/getsentry/sentry-javascript">
                          sentry-javascript
                        </ExternalLink>
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
} & RouteComponentProps<{projectId: string}, {}>;

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
