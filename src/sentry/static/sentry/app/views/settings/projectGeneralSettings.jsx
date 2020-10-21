import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import {Fragment} from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import Alert from 'app/components/alert';
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
import marked from 'app/utils/marked';
import recreateRoute from 'app/utils/recreateRoute';
import routeTitleGen from 'app/utils/routeTitle';

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
    return routeTitleGen(t('Project Settings'), projectId, false);
  }

  getEndpoints() {
    const {orgId, projectId} = this.props.params;

    return [
      ['data', `/projects/${orgId}/${projectId}/`],
      ['groupingConfigs', '/grouping-configs/'],
      ['groupingEnhancementBases', '/grouping-enhancements/'],
    ];
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

  getGroupingChanges() {
    let updateNotes = '';
    const byId = {};
    let riskLevel = 0;
    let latestGroupingConfig = null;
    let latestEnhancementsBase = null;

    this.state.groupingConfigs.forEach(cfg => {
      byId[cfg.id] = cfg;
      if (cfg.latest && this.state.data.groupingConfig !== cfg.id) {
        updateNotes = cfg.changelog;
        latestGroupingConfig = cfg;
        riskLevel = cfg.risk;
      }
    });

    if (latestGroupingConfig) {
      let next = latestGroupingConfig.base;
      while (next !== this.state.data.groupingConfig) {
        const cfg = byId[next];
        if (!cfg) {
          break;
        }
        riskLevel = Math.max(riskLevel, cfg.risk);
        updateNotes = cfg.changelog + '\n' + updateNotes;
        next = cfg.base;
      }
    }

    this.state.groupingEnhancementBases.forEach(cfg => {
      if (cfg.latest && this.state.data.groupingEnhancementsBase !== cfg.id) {
        updateNotes += '\n\n' + cfg.changelog;
        latestEnhancementsBase = cfg;
      }
    });

    return {updateNotes, riskLevel, latestGroupingConfig, latestEnhancementsBase};
  }

  renderUpgradeGrouping() {
    const {orgId, projectId} = this.props.params;

    if (!this.state.groupingConfigs || !this.state.groupingEnhancementBases) {
      return null;
    }

    const {
      updateNotes,
      riskLevel,
      latestGroupingConfig,
      latestEnhancementsBase,
    } = this.getGroupingChanges();
    const noUpdates = !latestGroupingConfig && !latestEnhancementsBase;
    const newData = {};
    if (latestGroupingConfig) {
      newData.groupingConfig = latestGroupingConfig.id;
    }
    if (latestEnhancementsBase) {
      newData.groupingEnhancementsBase = latestEnhancementsBase.id;
    }

    let riskNote;
    let alertType;
    switch (riskLevel) {
      case 0:
        riskNote = t('This upgrade has the chance to create some new issues.');
        alertType = 'info';
        break;
      case 1:
        riskNote = t('This upgrade will create some new issues.');
        alertType = 'warning';
        break;
      case 2:
        riskNote = (
          <strong>
            {t(
              'The new grouping strategy is incompatible with the current and will create entirely new issues.'
            )}
          </strong>
        );
        alertType = 'error';
        break;
      default:
    }

    return (
      <Field
        label={t('Upgrade Grouping Strategy')}
        help={tct(
          'If the project uses an old grouping strategy an update is possible.[linebreak]Doing so will cause new events to group differently.',
          {
            linebreak: <br />,
          }
        )}
      >
        <Confirm
          disabled={noUpdates}
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
          priority={riskLevel >= 2 ? 'danger' : 'primary'}
          title={t('Upgrade grouping strategy?')}
          confirmText={t('Upgrade')}
          message={
            <div>
              <TextBlock>
                <strong>{t('Upgrade Grouping Strategy')}</strong>
              </TextBlock>
              <TextBlock>
                {t(
                  'You can upgrade the grouping strategy to the latest but this is an irreversible operation.'
                )}
              </TextBlock>
              <TextBlock>
                <strong>{t('New Behavior')}</strong>
                <div dangerouslySetInnerHTML={{__html: marked(updateNotes)}} />
              </TextBlock>
              <TextBlock>
                <Alert type={alertType}>{riskNote}</Alert>
              </TextBlock>
            </div>
          }
        >
          <div>
            <Button
              disabled={noUpdates}
              title={noUpdates ? t('You are already on the latest version') : null}
              className="ref-upgrade-grouping-strategy"
              type="button"
              priority={riskLevel >= 2 ? 'danger' : 'primary'}
            >
              {t('Update Grouping Strategy')}
            </Button>
          </div>
        </Confirm>
      </Field>
    );
  }

  isProjectAdmin = () => new Set(this.context.organization.access).has('project:admin');

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

          <JsonForm
            {...jsonFormProps}
            title={<Fragment>{t('Grouping Settings')}</Fragment>}
            fields={[
              fields.groupingConfig,
              fields.groupingEnhancementsBase,
              fields.groupingEnhancements,
              fields.fingerprintingRules,
            ]}
            renderHeader={() => <Fragment>{this.renderUpgradeGrouping()}</Fragment>}
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
  onProjectsUpdate(_projects) {
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
