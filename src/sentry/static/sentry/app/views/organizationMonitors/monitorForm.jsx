import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {Observer} from 'mobx-react';

import Access from 'app/components/acl/access';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import {t, tct} from 'app/locale';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import MonitorModel from './monitorModel';

class MonitorForm extends Component {
  static propTypes = {
    monitor: SentryTypes.Monitor,
    organization: SentryTypes.Organization.isRequired,
    selection: SentryTypes.GlobalSelection,
    apiEndpoint: PropTypes.string.isRequired,
    apiMethod: PropTypes.string.isRequired,
    onSubmitSuccess: PropTypes.func.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.form = new MonitorModel();
  }

  formDataFromConfig(type, config) {
    switch (type) {
      case 'cron_job':
        return {
          'config.schedule_type': config.schedule_type,
          'config.schedule': config.schedule,
        };
      default:
        return {};
    }
  }

  render() {
    const {monitor} = this.props;
    const selectedProjectId = this.props.selection.projects[0];
    const selectedProject = selectedProjectId
      ? this.props.organization.projects.find(p => p.id === selectedProjectId + '')
      : null;
    return (
      <Access access={['project:write']}>
        {({hasAccess}) => (
          <Form
            allowUndo
            requireChanges
            apiEndpoint={this.props.apiEndpoint}
            apiMethod={this.props.apiMethod}
            model={this.form}
            initialData={
              monitor
                ? {
                    name: monitor.name,
                    type: monitor.type,
                    project: monitor.project.slug,
                    ...this.formDataFromConfig(monitor.type, monitor.config),
                  }
                : {
                    project: selectedProject ? selectedProject.slug : null,
                  }
            }
            onSubmitSuccess={this.props.onSubmitSuccess}
          >
            <Panel>
              <PanelHeader>{t('Details')}</PanelHeader>

              <PanelBody>
                {monitor && (
                  <Field label={t('ID')}>
                    <div className="controls">
                      <TextCopyInput>{monitor.id}</TextCopyInput>
                    </div>
                  </Field>
                )}
                <SelectField
                  name="project"
                  label={t('Project')}
                  disabled={!hasAccess}
                  choices={this.props.organization.projects
                    .filter(p => p.isMember)
                    .map(p => {
                      return [p.slug, p.slug];
                    })}
                  required
                />
                <TextField
                  name="name"
                  placeholder={t('My Cron Job')}
                  label={t('Name')}
                  disabled={!hasAccess}
                  required
                />
              </PanelBody>
            </Panel>
            <Panel>
              <PanelHeader>{t('Config')}</PanelHeader>

              <PanelBody>
                <SelectField
                  name="type"
                  label={t('Type')}
                  disabled={!hasAccess}
                  choices={[['cron_job', 'Cron Job']]}
                  required
                />
                <Observer>
                  {() => {
                    return (
                      this.form.getValue('type') === 'cron_job' && (
                        <SelectField
                          name="config.schedule_type"
                          label={t('Schedule Type')}
                          disabled={!hasAccess}
                          choices={[['crontab', 'Crontab']]}
                          required
                        />
                      )
                    );
                  }}
                </Observer>
                <Observer>
                  {() => {
                    return (
                      this.form.getValue('config.schedule_type') === 'crontab' && (
                        <TextField
                          name="config.schedule"
                          label={t('Schedule')}
                          disabled={!hasAccess}
                          placeholder="*/5 * * *"
                          required
                          help={tct(
                            'Changes to the schedule will apply on the next check-in. See [link:Wikipedia] for crontab syntax.',
                            {
                              link: <a href="https://en.wikipedia.org/wiki/Cron" />,
                            }
                          )}
                        />
                      )
                    );
                  }}
                </Observer>
              </PanelBody>
            </Panel>
          </Form>
        )}
      </Access>
    );
  }
}

export default withGlobalSelection(withOrganization(MonitorForm));
