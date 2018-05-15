import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'app/actionCreators/projects';
import {fields} from 'app/data/forms/projectGeneralSettings';
import {getOrganizationState} from 'app/mixins/organizationState';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import Confirm from 'app/components/confirm';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {Panel, PanelAlert, PanelHeader} from 'app/components/panels';
import ProjectsStore from 'app/stores/projectsStore';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextField from 'app/views/settings/components/forms/textField';
import recreateRoute from 'app/utils/recreateRoute';

class ProjectGeneralSettings extends AsyncView {
  static propTypes = {
    onChangeSlug: PropTypes.func,
  };

  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this._form = {};
  }

  getTitle() {
    let {projectId} = this.props.params;
    return t('%s Settings', projectId);
  }

  getEndpoints() {
    let {orgId, projectId} = this.props.params;
    return [['data', `/projects/${orgId}/${projectId}/`]];
  }

  handleTransferFieldChange = (id, value) => {
    this._form[id] = value;
  };

  handleRemoveProject = () => {
    let {orgId} = this.props.params;
    let project = this.state.data;
    if (!project) return;

    removeProject(this.api, orgId, project).then(() => {
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    });
  };

  handleTransferProject = () => {
    let {orgId} = this.props.params;
    let project = this.state.data;
    if (!project) return;
    if (!this._form.email) return;

    transferProject(this.api, orgId, project, this._form.email).then(() => {
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    });
  };

  renderRemoveProject() {
    let project = this.state.data;
    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');
    let {isInternal} = project;

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

        {isProjectAdmin &&
          !isInternal && (
            <Confirm
              onConfirm={this.handleRemoveProject}
              priority="danger"
              title={t('Remove project?')}
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
    let project = this.state.data;
    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');
    let {isInternal} = project;

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

        {isProjectAdmin &&
          !isInternal && (
            <Confirm
              onConfirm={this.handleTransferProject}
              priority="danger"
              title={`${t('Transfer project')}?`}
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
                      'Please enter the organization owner you would like to transfer this project to.'
                    )}
                  </TextBlock>
                  <Panel>
                    <Form
                      hideFooter
                      onFieldChange={this.handleTransferFieldChange}
                      onSubmit={(data, onSuccess, onError, e) => {
                        e.stopPropagation();
                        confirm();
                      }}
                    >
                      <TextField
                        name="email"
                        label={t('Organization Owner')}
                        placeholder="admin@example.com"
                        required
                        help={tct(
                          'A request will be emailed to the new owner in order to transfer [project] to a new organization.',
                          {
                            project: <strong> {project.slug} </strong>,
                          }
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
    let {organization} = this.context;
    let project = this.state.data;
    let {orgId, projectId} = this.props.params;
    let endpoint = `/projects/${orgId}/${projectId}/`;
    let jsonFormProps = {
      additionalFieldProps: {organization},
      access: new Set(organization.access),
    };

    return (
      <div>
        <SettingsPageHeader title={t('Project Settings')} />

        <Form
          saveOnBlur
          allowUndo
          initialData={{
            ...project,
            team: project.team && project.team.slug,
          }}
          apiMethod="PUT"
          apiEndpoint={endpoint}
          onSubmitSuccess={resp => {
            if (projectId !== resp.slug) {
              changeProjectSlug(projectId, resp.slug);
              // Container will redirect after stores get updated with new slug
              this.props.onChangeSlug(resp.slug);
            }
          }}
        >
          <JsonForm
            {...jsonFormProps}
            title={t('Project Details')}
            fields={[fields.slug, fields.name, fields.team]}
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
            title={t('Data Privacy')}
            fields={[
              fields.dataScrubber,
              fields.dataScrubberDefaults,
              fields.scrubIPAddresses,
              fields.sensitiveFields,
              fields.safeFields,
            ]}
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
                      link: <a href="https://github.com/getsentry/raven-js">raven-js</a>,
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

const ProjectGeneralSettingsContainer = createReactClass({
  mixins: [Reflux.listenTo(ProjectsStore, 'onProjectsUpdate')],
  onProjectsUpdate(projects) {
    if (!this.changedSlug) return;
    let project = ProjectsStore.getBySlug(this.changedSlug);

    if (!project) return;

    browserHistory.replace(
      recreateRoute('', {
        ...this.props,
        params: {
          ...this.props.params,
          projectId: this.changedSlug,
        },
      })
    );
  },

  render() {
    return (
      <ProjectGeneralSettings
        onChangeSlug={newSlug => (this.changedSlug = newSlug)}
        {...this.props}
      />
    );
  },
});

export default ProjectGeneralSettingsContainer;
