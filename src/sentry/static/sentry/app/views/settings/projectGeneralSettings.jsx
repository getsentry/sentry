import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import marked from 'marked';

import {Panel, PanelAlert, PanelHeader} from 'app/components/panels';
import {
  changeProjectSlug,
  removeProject,
  transferProject,
} from 'app/actionCreators/projects';
import {addLoadingMessage, clearIndicators} from 'app/actionCreators/indicator';
import {fields} from 'app/data/forms/projectGeneralSettings';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import PermissionAlert from 'app/views/settings/project/permissionAlert';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextField from 'app/views/settings/components/forms/textField';
import handleXhrErrorResponse from 'app/utils/handleXhrErrorResponse';
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
    const {projectId} = this.props.params;
    return t('%s Settings', projectId);
  }

  getEndpoints() {
    const {orgId, projectId} = this.props.params;
    const endpoints = [['data', `/projects/${orgId}/${projectId}/`]];
    const {organization} = this.context;
    const features = new Set(organization.features);
    if (features.has('set-grouping-config') || features.has('tweak-grouping-config')) {
      endpoints.push(['groupingConfigs', '/grouping-configs/']);
      endpoints.push(['groupingEnhancementBases', '/grouping-enhancements/']);
    }
    return endpoints;
  }

  handleTransferFieldChange = (id, value) => {
    this._form[id] = value;
  };

  handleRemoveProject = () => {
    const {orgId} = this.props.params;
    const project = this.state.data;
    if (!project) {
      return;
    }

    removeProject(this.api, orgId, project).then(() => {
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    }, handleXhrErrorResponse('Unable to remove project'));
  };

  handleTransferProject = () => {
    const {orgId} = this.props.params;
    const project = this.state.data;
    if (!project) {
      return;
    }
    if (!this._form.email) {
      return;
    }

    transferProject(this.api, orgId, project, this._form.email).then(() => {
      // Need to hard reload because lots of components do not listen to Projects Store
      window.location.assign('/');
    }, handleXhrErrorResponse('Unable to transfer project'));
  };

  renderUpgradeGrouping() {
    const {orgId, projectId} = this.props.params;

    if (!this.state.groupingConfigs || !this.state.groupingEnhancementBases) {
      return null;
    }

    let updateNotes = '';
    const newData = {};

    this.state.groupingConfigs.forEach(({id, latest, changelog}) => {
      if (latest && this.state.data.groupingConfig !== id) {
        updateNotes += changelog + '\n\n';
        newData.groupingConfig = id;
      }
    });

    this.state.groupingEnhancementBases.forEach(({id, latest, changelog}) => {
      if (latest && this.state.data.groupingEnhancementsBase !== id) {
        updateNotes += changelog + '\n\n';
        newData.groupingEnhancementsBase = id;
      }
    });

    if (Object.keys(newData).length === 0) {
      return null;
    }

    return (
      <Field
        label={t('Upgrade Grouping Strategy')}
        help={tct(
          'This project uses an old grouping strategy and an update is possible.[linebreak]Doing so will cause new events to group differently.',
          {
            linebreak: <br />,
          }
        )}
      >
        <Confirm
          onConfirm={() => {
            addLoadingMessage(t('Changing grouping...'));
            this.api
              .requestPromise(`/projects/${orgId}/${projectId}/`, {
                method: 'PUT',
                data: newData,
              })
              .then(resp => {
                clearIndicators();
                ProjectActions.updateSuccess(resp);
                this.fetchData();
              }, handleXhrErrorResponse('Unable to upgrade config'));
          }}
          priority="danger"
          title={t('Upgrade grouping strategy?')}
          confirmText={t('Upgrade')}
          message={
            <div>
              <TextBlock>
                <strong>
                  {t(
                    'This will upgrade grouping and cause new events to group differently.'
                  )}
                </strong>
              </TextBlock>
              <TextBlock>
                {t(
                  'From this moment onwards new events are likely to generate new groups.'
                )}
                <br />
                <br />
                <strong>{t('New Behavior')}</strong>
                <div dangerouslySetInnerHTML={{__html: marked(updateNotes)}} />
              </TextBlock>
            </div>
          }
        >
          <div>
            <Button
              className="ref-upgrade-grouping-strategy"
              type="button"
              priority="primary"
            >
              {t('Update Grouping Strategy')}
            </Button>
          </div>
        </Confirm>
      </Field>
    );
  }

  isProjectAdmin = () => {
    return new Set(this.context.organization.access).has('project:admin');
  };

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
                    'Please enter the email of an organization owner to whom you would like to transfer this project.'
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
    const {organization} = this.context;
    const project = this.state.data;
    const {orgId, projectId} = this.props.params;
    const endpoint = `/projects/${orgId}/${projectId}/`;
    const access = new Set(organization.access);
    const jsonFormProps = {
      additionalFieldProps: {
        organization,
        groupingConfigs: this.state.groupingConfigs,
        groupingEnhancementBases: this.state.groupingEnhancementBases,
      },
      features: new Set(organization.features),
      access,
      disabled: !access.has('project:write'),
    };

    return (
      <div>
        <SettingsPageHeader title={t('Project Settings')} />
        <PermissionAlert />

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
            // this is necessary for the grouping upgrade button to be
            // updating based on the current selection of the grouping
            // config.
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

          {(jsonFormProps.features.has('set-grouping-config') ||
            jsonFormProps.features.has('tweak-grouping-config')) && (
            <JsonForm
              {...jsonFormProps}
              title={t('Grouping Settings')}
              fields={[
                fields.groupingConfig,
                fields.groupingEnhancementsBase,
                fields.groupingEnhancements,
                fields.fingerprintingRules,
              ]}
              renderHeader={() => (
                <>
                  <PanelAlert type="warning">
                    <TextBlock noMargin>
                      {t(
                        'This is an experimental feature. Changing the value here will only apply to future events and is likely to cause events to create different groups than before.'
                      )}
                    </TextBlock>
                  </PanelAlert>
                  {jsonFormProps.features.has('tweak-grouping-config') &&
                    this.renderUpgradeGrouping()}
                </>
              )}
            />
          )}

          <JsonForm
            {...jsonFormProps}
            title={t('Data Privacy')}
            fields={[
              fields.dataScrubber,
              fields.dataScrubberDefaults,
              fields.scrubIPAddresses,
              fields.sensitiveFields,
              fields.safeFields,
              fields.storeCrashReports,
              fields.relayPiiConfig,
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

const ProjectGeneralSettingsContainer = createReactClass({
  mixins: [Reflux.listenTo(ProjectsStore, 'onProjectsUpdate')],
  onProjectsUpdate(projects) {
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
