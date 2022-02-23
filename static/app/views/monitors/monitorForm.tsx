import {Component, Fragment} from 'react';
import {Observer} from 'mobx-react';

import Access from 'sentry/components/acl/access';
import Field from 'sentry/components/forms/field';
import Form from 'sentry/components/forms/form';
import NumberField from 'sentry/components/forms/numberField';
import SelectField from 'sentry/components/forms/selectField';
import TextCopyInput from 'sentry/components/forms/textCopyInput';
import TextField from 'sentry/components/forms/textField';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t, tct} from 'sentry/locale';
import {PageFilters, Project, SelectValue} from 'sentry/types';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import MonitorModel from './monitorModel';
import {Monitor, MonitorConfig, MonitorTypes, ScheduleType} from './types';

const SCHEDULE_TYPES: SelectValue<ScheduleType>[] = [
  {value: 'crontab', label: 'Crontab'},
  {value: 'interval', label: 'Interval'},
];

const MONITOR_TYPES: SelectValue<MonitorTypes>[] = [
  {value: 'cron_job', label: 'Cron Job'},
];

const INTERVALS: SelectValue<string>[] = [
  {value: 'minute', label: 'minute(s)'},
  {value: 'hour', label: 'hour(s)'},
  {value: 'day', label: 'day(s)'},
  {value: 'week', label: 'week(s)'},
  {value: 'month', label: 'month(s)'},
  {value: 'year', label: 'year(s)'},
];

type Props = {
  apiEndpoint: string;
  apiMethod: Form['props']['apiMethod'];
  onSubmitSuccess: Form['props']['onSubmitSuccess'];
  projects: Project[];
  selection: PageFilters;
  monitor?: Monitor;
};

class MonitorForm extends Component<Props> {
  form = new MonitorModel();

  formDataFromConfig(type: MonitorTypes, config: MonitorConfig) {
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
      ? this.props.projects.find(p => p.id === selectedProjectId + '')
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
                  options={this.props.projects
                    .filter(p => p.isMember)
                    .map(p => ({value: p.slug, label: p.slug}))}
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
                  options={MONITOR_TYPES}
                  required
                />
                <Observer>
                  {() => {
                    switch (this.form.getValue('type')) {
                      case 'cron_job':
                        return (
                          <Fragment>
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
                              options={SCHEDULE_TYPES}
                              required
                            />
                          </Fragment>
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
                          <Fragment>
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
                          </Fragment>
                        );
                      case 'interval':
                        return (
                          <Fragment>
                            <NumberField
                              name="config.schedule.frequency"
                              label={t('Frequency')}
                              disabled={!hasAccess}
                              placeholder="e.g. 1"
                              required
                            />
                            <SelectField
                              name="config.schedule.interval"
                              label={t('Interval')}
                              disabled={!hasAccess}
                              options={INTERVALS}
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
                          </Fragment>
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

export default withPageFilters(withProjects(MonitorForm));
