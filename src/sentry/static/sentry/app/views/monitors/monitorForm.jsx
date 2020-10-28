import React, {Component} from 'react';
import PropTypes from 'prop-types';
import {Observer} from 'mobx-react';

import Access from 'app/components/acl/access';
import Field from 'app/views/settings/components/forms/field';
import Form from 'app/views/settings/components/forms/form';
import NumberField from 'app/views/settings/components/forms/numberField';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextCopyInput from 'app/views/settings/components/forms/textCopyInput';
import TextField from 'app/views/settings/components/forms/textField';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import SentryTypes from 'app/sentryTypes';
import {t, tct} from 'app/locale';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import MonitorModel from './monitorModel';

const SCHEDULE_TYPES = [
  ['crontab', 'Crontab'],
  ['interval', 'Interval'],
];

const MONITOR_TYPES = [['cron_job', 'Cron Job']];

const INTERVALS = [
  ['minute', 'minute(s)'],
  ['hour', 'hour(s)'],
  ['day', 'day(s)'],
  ['week', 'week(s)'],
  ['month', 'month(s)'],
  ['year', 'year(s)'],
];

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
    const rv = {};
    switch (type) {
      case 'cron_job':
        rv['config.schedule_type'] = config.schedule_type;
        rv['config.checkin_margin'] = config.checkin_margin;
        rv['config.max_runtime'] = config.max_runtime;

        switch (config.schedule_type) {
          case 'interval':
            rv['config.schedule.frequency'] = config.schedule[0];
            rv['config.schedule.interval'] = config.schedule[1];
            break;
          case 'crontab':
          default:
            rv['config.schedule'] = config.schedule;
        }
        break;
      default:
    }
    return rv;
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
                    .map(p => [p.slug, p.slug])}
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
                  choices={MONITOR_TYPES}
                  required
                />
                <Observer>
                  {() => {
                    switch (this.form.getValue('type')) {
                      case 'cron_job':
                        return (
                          <React.Fragment>
                            <NumberField
                              name="config.max_runtime"
                              label={t('Max Runtime')}
                              disabled={!hasAccess}
                              help={t(
                                "The maximum runtime (in minutes) a check-in is allowed before it's marked as a failure."
                              )}
                              placeholder="e.g. 30"
                            />
                            <SelectField
                              name="config.schedule_type"
                              label={t('Schedule Type')}
                              disabled={!hasAccess}
                              choices={SCHEDULE_TYPES}
                              required
                            />
                          </React.Fragment>
                        );
                      default:
                        return null;
                    }
                  }}
                </Observer>
                <Observer>
                  {() => {
                    switch (this.form.getValue('config.schedule_type')) {
                      case 'crontab':
                        return (
                          <React.Fragment>
                            <TextField
                              name="config.schedule"
                              label={t('Schedule')}
                              disabled={!hasAccess}
                              placeholder="*/5 * * * *"
                              required
                              help={tct(
                                'Changes to the schedule will apply on the next check-in. See [link:Wikipedia] for crontab syntax.',
                                {
                                  link: <a href="https://en.wikipedia.org/wiki/Cron" />,
                                }
                              )}
                            />
                            <NumberField
                              name="config.checkin_margin"
                              label={t('Check-in Margin')}
                              disabled={!hasAccess}
                              help={t(
                                "The margin (in minutes) a check-in is allowed to exceed it's scheduled window before being treated as missed."
                              )}
                              placeholder="e.g. 30"
                            />
                          </React.Fragment>
                        );
                      case 'interval':
                        return (
                          <React.Fragment>
                            <NumberField
                              name="config.schedule.frequency"
                              label={t('Frequency')}
                              disabled={!hasAccess}
                              placeholder="e.g. 1"
                              required
                            />
                            <SelectField
                              deprecatedSelectControl
                              name="config.schedule.interval"
                              label={t('Interval')}
                              disabled={!hasAccess}
                              choices={INTERVALS}
                              required
                            />
                            <NumberField
                              name="config.checkin_margin"
                              label={t('Check-in Margin')}
                              disabled={!hasAccess}
                              help={t(
                                "The margin (in minutes) a check-in is allowed to exceed it's scheduled window before being treated as missed."
                              )}
                              placeholder="e.g. 30"
                            />
                          </React.Fragment>
                        );
                      default:
                        return null;
                    }
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
