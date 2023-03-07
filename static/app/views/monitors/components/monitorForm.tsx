import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import FieldGroup from 'sentry/components/forms/fieldGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import TextCopyInput from 'sentry/components/textCopyInput';
import TimeSince from 'sentry/components/timeSince';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import {SelectValue} from 'sentry/types';
import commonTheme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

import {
  IntervalConfig,
  Monitor,
  MonitorConfig,
  MonitorType,
  ScheduleType,
} from '../types';

const SCHEDULE_TYPES: SelectValue<ScheduleType>[] = [
  {value: ScheduleType.CRONTAB, label: 'Crontab'},
  {value: ScheduleType.INTERVAL, label: 'Interval'},
];

const DEFAULT_MONITOR_TYPE = 'cron_job';

const getIntervals = (n: number): SelectValue<string>[] => [
  {value: 'minute', label: tn('minute', 'minutes', n)},
  {value: 'hour', label: tn('hour', 'hours', n)},
  {value: 'day', label: tn('day', 'days', n)},
  {value: 'week', label: tn('week', 'weeks', n)},
  {value: 'month', label: tn('month', 'months', n)},
  {value: 'year', label: tn('year', 'years', n)},
];

type Props = {
  apiEndpoint: string;
  apiMethod: FormProps['apiMethod'];
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  monitor?: Monitor;
  submitLabel?: string;
};

type TransformedData = {
  config?: Partial<MonitorConfig>;
};

function transformData(_data: Record<string, any>, model: FormModel) {
  return model.fields.toJSON().reduce<TransformedData>((data, [k, v]) => {
    // We're only concerned with transforming the config
    if (!k.startsWith('config.')) {
      data[k] = v;
      return data;
    }

    // Default to empty object
    data.config ??= {};

    if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
      if (!Array.isArray(data.config.schedule)) {
        data.config.schedule = [1, 'hour'];
      }
    }

    if (Array.isArray(data.config.schedule) && k === 'config.schedule.frequency') {
      data.config.schedule![0] = parseInt(v as string, 10);
      return data;
    }

    if (Array.isArray(data.config.schedule) && k === 'config.schedule.interval') {
      data.config.schedule![1] = v as IntervalConfig['schedule'][1];
      return data;
    }

    data.config[k.substr(7)] = v;
    return data;
  }, {});
}

function MonitorForm({
  monitor,
  submitLabel,
  apiEndpoint,
  apiMethod,
  onSubmitSuccess,
}: Props) {
  const form = useRef(new FormModel({transformData}));
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  function formDataFromConfig(type: MonitorType, config: MonitorConfig) {
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
            rv['config.timezone'] = config.timezone;
        }
        break;
      default:
    }
    return rv;
  }

  const selectedProjectId = selection.projects[0];
  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId + '')
    : null;

  return (
    <Form
      allowUndo
      requireChanges
      apiEndpoint={apiEndpoint}
      apiMethod={apiMethod}
      model={form.current}
      initialData={
        monitor
          ? {
              name: monitor.name,
              type: monitor.type ?? DEFAULT_MONITOR_TYPE,
              project: monitor.project.slug,
              ...formDataFromConfig(monitor.type, monitor.config),
            }
          : {
              project: selectedProject ? selectedProject.slug : null,
              type: DEFAULT_MONITOR_TYPE,
            }
      }
      onSubmitSuccess={onSubmitSuccess}
      submitLabel={submitLabel}
    >
      <Panel>
        <PanelHeader>{t('Details')}</PanelHeader>

        <PanelBody>
          <SentryProjectSelectorField
            name="project"
            label={t('Project')}
            projects={projects.filter(project => project.isMember)}
            disabled={!!monitor}
            disabledReason={t('Existing monitors cannot be moved between projects')}
            valueIsSlug
            help={t(
              "Select the project which contains the recurring job you'd like to monitor."
            )}
            required
          />
          {monitor && (
            <FieldGroup
              label={t('Monitor Slug')}
              flexibleControlStateSize
              help={t(
                'The monitor slug is the organization-wide unique identifier for your monitor.'
              )}
            >
              <TextCopyInput>{monitor.slug}</TextCopyInput>
            </FieldGroup>
          )}
          <TextField
            name="name"
            placeholder={t('My Cron Job')}
            label={t('Name your cron monitor')}
            required
          />
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader>{t('Config')}</PanelHeader>

        <PanelBody>
          {monitor !== undefined && monitor.nextCheckIn && (
            <PanelAlert type="info">
              {tct(
                'Any changes you make to the execution schedule will only be applied after the next expected check-in [nextCheckin].',
                {
                  nextCheckin: (
                    <strong>
                      <TimeSince date={monitor.nextCheckIn} />
                    </strong>
                  ),
                }
              )}
            </PanelAlert>
          )}
          <NumberField
            name="config.max_runtime"
            label={t('Max Runtime')}
            help={t(
              "Set the number of minutes a recurring job is allowed to run before it's considered failed."
            )}
            placeholder="e.g. 30"
          />
          <SelectField
            name="config.schedule_type"
            label={t('Schedule Type')}
            options={SCHEDULE_TYPES}
            defaultValue={ScheduleType.CRONTAB}
            required
          />
          <Observer>
            {() => {
              switch (form.current.getValue('config.schedule_type')) {
                case 'crontab':
                  return (
                    <Fragment>
                      <TextField
                        name="config.schedule"
                        label={t('Schedule')}
                        placeholder="*/5 * * * *"
                        required
                        help={tct(
                          'Any schedule changes will be applied to the next check-in. See [link:Wikipedia] for crontab syntax.',
                          {
                            link: (
                              <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />
                            ),
                          }
                        )}
                        css={{input: {fontFamily: commonTheme.text.familyMono}}}
                      />
                      <SelectField
                        name="config.timezone"
                        label={t('Timezone')}
                        defaultValue="UTC"
                        options={timezoneOptions}
                        help={tct(
                          "The timezone of your execution environment. Be sure to set this correctly, otherwise the schedule may be mismatched and check-ins will be marked as missed! Use [code:timedatectl] or similar to determine your machine's timezone.",
                          {code: <code />}
                        )}
                      />
                      <NumberField
                        name="config.checkin_margin"
                        label={t('Check-in Margin')}
                        help={t(
                          "The max error margin (in minutes) before a check-in is considered missed. If you don't expect your job to start immediately at the scheduled time, expand this margin to account for delays."
                        )}
                        placeholder="e.g. 30"
                      />
                    </Fragment>
                  );
                case 'interval':
                  return (
                    <Fragment>
                      <CombinedField>
                        <FieldGroup
                          label={t('Frequency')}
                          help={t(
                            'The amount of time between each job execution. Example, every 5 hours.'
                          )}
                          stacked
                          required
                        />
                        <StyledNumberField
                          name="config.schedule.frequency"
                          label={t('Frequency')}
                          placeholder="e.g. 1"
                          hideLabel
                          required
                        />
                        <StyledSelectField
                          name="config.schedule.interval"
                          label={t('Interval')}
                          options={getIntervals(
                            Number(
                              form.current.getValue('config.schedule.frequency') ?? 1
                            )
                          )}
                          hideLabel
                          required
                        />
                      </CombinedField>
                      <NumberField
                        name="config.checkin_margin"
                        label={t('Check-in Margin')}
                        help={t(
                          "The max error margin (in minutes) before a check-in is considered missed. If you don't expect your job to start immediately at the scheduled time, expand this margin to account for delays."
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
  );
}

export default MonitorForm;

const CombinedField = styled('div')`
  display: grid;
  grid-template-columns: 50% 1fr 1fr;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
`;

const StyledNumberField = styled(NumberField)`
  padding: 0;
  border-bottom: none;
`;

const StyledSelectField = styled(SelectField)`
  padding-left: 0;
`;
