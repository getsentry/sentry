import {Component, Fragment} from 'react';
import {Observer} from 'mobx-react';

import Access from 'sentry/components/acl/access';
import Field from 'sentry/components/forms/field';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {PageFilters, Project, SelectValue} from 'sentry/types';
import withPageFilters from 'sentry/utils/withPageFilters';
import withProjects from 'sentry/utils/withProjects';

import {Monitor, MonitorConfig, MonitorTypes, ScheduleType} from './types';

const SCHEDULE_TYPES: SelectValue<ScheduleType>[] = [
  {value: 'crontab', label: 'Crontab'},
  {value: 'interval', label: 'Interval'},
];

const DEFAULT_MONITOR_TYPE = 'cron_job';

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
  apiMethod: FormProps['apiMethod'];
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  projects: Project[];
  selection: PageFilters;
  monitor?: Monitor;
  submitLabel?: string;
};

type TransformedData = {
  config?: Partial<MonitorConfig>;
};

function transformData(_data: Record<string, any>, model: FormModel) {
  return model.fields.toJSON().reduce<TransformedData>((data, [k, v]) => {
    if (k.indexOf('config.') !== 0) {
      data[k] = v;
      return data;
    }

    if (!data.config) {
      data.config = {};
    }
    if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
      if (!Array.isArray(data.config.schedule)) {
        data.config.schedule = [null, null];
      }
    }

    if (k === 'config.schedule.frequency') {
      data.config!.schedule![0] = parseInt(v as string, 10);
    } else if (k === 'config.schedule.interval') {
      data.config!.schedule![1] = v;
    } else {
      data.config[k.substr(7)] = v;
    }

    return data;
  }, {});
}

class MonitorForm extends Component<Props> {
  form = new FormModel({transformData});

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
    const {monitor, submitLabel} = this.props;
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
                    type: monitor.type ?? DEFAULT_MONITOR_TYPE,
                    project: monitor.project.slug,
                    ...this.formDataFromConfig(monitor.type, monitor.config),
                  }
                : {
                    project: selectedProject ? selectedProject.slug : null,
                    type: DEFAULT_MONITOR_TYPE,
                  }
            }
            onSubmitSuccess={this.props.onSubmitSuccess}
            submitLabel={submitLabel}
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
                  help={t('Associate your monitor with the appropriate project.')}
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
                              help={t(
                                'The amount of intervals that pass between executions of the cron job.'
                              )}
                              required
                            />
                            <SelectField
                              name="config.schedule.interval"
                              label={t('Interval')}
                              disabled={!hasAccess}
                              options={INTERVALS}
                              help={t(
                                'The interval on which the frequency will be applied. 1 time every X amount of (minutes, hours, days)'
                              )}
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
