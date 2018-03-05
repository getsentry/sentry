import {Box} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';

import {getOrganizationState} from '../mixins/organizationState';
import {removeProject, transferProject} from '../actionCreators/projects';
import {t, tct} from '../locale';
import AsyncView from './asyncView';
import Button from '../components/buttons/button';
import Confirm from '../components/confirm';
import Field from './settings/components/forms/field';
import Form from './settings/components/forms/form';
import JsonForm from './settings/components/forms/jsonForm';
import Panel from './settings/components/panel';
import PanelAlert from './settings/components/panelAlert';
import PanelHeader from './settings/components/panelHeader';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import TextBlock from './settings/components/text/textBlock';
import TextField from './settings/components/forms/textField';
import projectFields from '../data/forms/projectGeneralSettings';

const noMargin = {marginBottom: 0};

const AutoResolveFooter = () => (
  <Box p={2} pb={0}>
    <PanelAlert type="warning" icon="icon-circle-exclamation" css={noMargin}>
      <strong>
        {t(`Note: Enabling auto resolve will immediately resolve anything that has
                  not been seen within this period of time. There is no undo!`)}
      </strong>
    </PanelAlert>
  </Box>
);

export default class ProjectGeneralSettings extends AsyncView {
  static contextTypes = {
    organization: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this._form = {};
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

    if (!isProjectAdmin) {
      return (
        <Field inline={false}>
          {t('You do not have the required permission to remove this project.')}
        </Field>
      );
    } else if (project.isInternal) {
      return (
        <Field inline={false}>
          {t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}
        </Field>
      );
    } else {
      return (
        <Field
          label={tct('Remove the [project] project and all related data.', {
            project: <strong>{project.slug}</strong>,
          })}
          help={t('Careful, this action cannot be undone.')}
        >
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
        </Field>
      );
    }
  }

  renderTransferProject() {
    let project = this.state.data;
    let isProjectAdmin = getOrganizationState(this.context.organization)
      .getAccess()
      .has('project:admin');

    if (!isProjectAdmin) {
      return (
        <Field inline={false}>
          {t('You do not have the required permission to transfer this project.')}
        </Field>
      );
    } else if (project.isInternal) {
      return (
        <Field inline={false}>
          {t(
            'This project cannot be removed. It is used internally by the Sentry server.'
          )}
        </Field>
      );
    } else {
      return (
        <Field
          label={tct('Transfer the [project] project and all related data.', {
            project: <strong>{project.slug}</strong>,
          })}
          help={t('Careful, this action cannot be undone.')}
        >
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
                    'Please enter the owner of the organization you would like to transfer this project to.'
                  )}
                </TextBlock>
                <Panel>
                  <PanelHeader>{t('Transfer to')}</PanelHeader>
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
        </Field>
      );
    }
  }

  renderBody() {
    let {organization} = this.context;
    let project = this.state.data;
    let {orgId, projectId} = this.props.params;
    let endpoint = `/projects/${orgId}/${projectId}/`;

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
            // Reload if slug has changed
            if (projectId !== resp.slug) {
              window.location = `/${organization.slug}/${resp.slug}/settings/`;
            }
          }}
        >
          <JsonForm
            forms={projectFields}
            additionalFieldProps={{organization}}
            access={new Set(organization.access)}
            renderBodyStart={({title}) => {
              if (title === 'Client Security') {
                return (
                  <Box p={2} pb={0}>
                    <PanelAlert type="info" icon="icon-circle-exclamation" css={noMargin}>
                      <TextBlock css={noMargin}>
                        {tct(
                          'Configure origin URLs which Sentry should accept events from. This is used for communication with clients like [link].',
                          {
                            link: (
                              <a href="https://github.com/getsentry/raven-js">raven-js</a>
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
                  </Box>
                );
              }
              return null;
            }}
            renderFooter={({title}) => {
              if (title === 'Event Settings') {
                return <AutoResolveFooter />;
              }
              return null;
            }}
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
