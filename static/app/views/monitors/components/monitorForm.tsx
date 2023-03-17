import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Text from 'sentry/components/text';
import TextCopyInput from 'sentry/components/textCopyInput';
import TimeSince from 'sentry/components/timeSince';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import commonTheme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import MonitorQuickStartGuide from 'sentry/views/monitors/components/monitorQuickStartGuide';
import {crontabAsText} from 'sentry/views/monitors/utils';

import {
  IntervalConfig,
  Monitor,
  MonitorConfig,
  MonitorType,
  ScheduleType,
} from '../types';

const SCHEDULE_OPTIONS: RadioOption<string>[] = [
  [ScheduleType.CRONTAB, t('Crontab')],
  [ScheduleType.INTERVAL, t('Interval')],
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
  const [crontabInput, setCrontabInput] = useState(
    monitor?.config.schedule_type === ScheduleType.CRONTAB
      ? monitor?.config.schedule
      : null
  );

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

  const parsedSchedule = crontabAsText(crontabInput);

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
      <StyledList symbol="colored-numeric">
        <StyledListItem>{t('Add a name and project')}</StyledListItem>
        <ListItemSubText>
          {t('The monitor name will show up in alerts and notifications')}
        </ListItemSubText>
        <InputGroup>
          <StyledTextField
            name="name"
            placeholder={t('My Cron Job')}
            required
            stacked
            inline={false}
          />
          <StyledSentryProjectSelectorField
            name="project"
            projects={projects.filter(project => project.isMember)}
            placeholder={t('Choose Project')}
            disabled={!!monitor}
            disabledReason={t('Existing monitors cannot be moved between projects')}
            valueIsSlug
            required
            stacked
            inline={false}
          />
          {monitor && (
            <StyledFieldGroup flexibleControlStateSize stacked inline={false}>
              <StyledTextCopyInput>{monitor.slug}</StyledTextCopyInput>
            </StyledFieldGroup>
          )}
        </InputGroup>

        <StyledListItem>{t('Choose your schedule type')}</StyledListItem>
        <ListItemSubText>
          {tct('You can use [link:the crontab syntax] or our interval schedule.', {
            link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />,
          })}
        </ListItemSubText>
        <InputGroup>
          <RadioField
            name="config.schedule_type"
            choices={SCHEDULE_OPTIONS}
            defaultValue={ScheduleType.CRONTAB}
            orientInline
            required
            stacked
            inline={false}
          />
        </InputGroup>
        <StyledListItem>{t('Choose your schedule')}</StyledListItem>
        <ListItemSubText>
          {t('How often you expect your recurring jobs to run.')}
        </ListItemSubText>
        <InputGroup>
          {monitor !== undefined && monitor.nextCheckIn && (
            <Alert type="info">
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
            </Alert>
          )}
          <Observer>
            {() => {
              const schedule_type = form.current.getValue('config.schedule_type');
              if (schedule_type === 'crontab') {
                return (
                  <ScheduleGroupInputs>
                    <StyledTextField
                      name="config.schedule"
                      placeholder="*/5 * * * *"
                      css={{input: {fontFamily: commonTheme.text.familyMono}}}
                      required
                      stacked
                      onChange={setCrontabInput}
                      inline={false}
                    />
                    <StyledSelectField
                      name="config.timezone"
                      defaultValue="UTC"
                      options={timezoneOptions}
                      required
                      stacked
                      inline={false}
                    />
                    {parsedSchedule && <CronstrueText>"{parsedSchedule}"</CronstrueText>}
                  </ScheduleGroupInputs>
                );
              }
              if (schedule_type === 'interval') {
                return (
                  <ScheduleGroupInputs interval>
                    <LabelText>{t('Every')}</LabelText>
                    <StyledNumberField
                      name="config.schedule.frequency"
                      placeholder="e.g. 1"
                      required
                      stacked
                      inline={false}
                    />
                    <StyledSelectField
                      name="config.schedule.interval"
                      options={getIntervals(
                        Number(form.current.getValue('config.schedule.frequency') ?? 1)
                      )}
                      placeholder="minute"
                      required
                      stacked
                      inline={false}
                    />
                  </ScheduleGroupInputs>
                );
              }
              return null;
            }}
          </Observer>
        </InputGroup>
        <StyledListItem>{t('Set a missed status')}</StyledListItem>
        <ListItemSubText>
          {t("The number of minutes we'll wait before we consider a check-in as missed.")}
        </ListItemSubText>
        <InputGroup>
          <StyledNumberField
            name="config.checkin_margin"
            placeholder="e.g. 30"
            stacked
            inline={false}
          />
        </InputGroup>
        <StyledListItem>{t('Set a failed status')}</StyledListItem>
        <ListItemSubText>
          {t(
            "The number of minutes a check-in is allowed to run before it's considered failed."
          )}
        </ListItemSubText>
        <InputGroup>
          <StyledNumberField
            name="config.max_runtime"
            placeholder="e.g. 30"
            stacked
            inline={false}
          />
        </InputGroup>
        <Observer>
          {() => {
            const currentSelectedSlug = form.current.getValue('project');
            const project = projects.find(({slug}) => slug === currentSelectedSlug);

            return (
              <Fragment>
                <StyledListItem>{t('Instrument your monitor')}</StyledListItem>
                <ListItemSubText>
                  {project
                    ? t(
                        "Select an option from the list below and we'll walk you through the setup process."
                      )
                    : t('Select a project to see instrumentation options')}
                </ListItemSubText>
                {project && (
                  <InputGroup>
                    <MonitorQuickStartGuide platform={project?.platform} />
                  </InputGroup>
                )}
              </Fragment>
            );
          }}
        </Observer>
      </StyledList>
    </Form>
  );
}

export default MonitorForm;

const StyledList = styled(List)`
  width: 600px;
`;

const StyledTextCopyInput = styled(TextCopyInput)`
  padding: 0;
`;

const StyledNumberField = styled(NumberField)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
`;

const StyledFieldGroup = styled(FieldGroup)`
  padding: 0;
`;

const StyledTextField = styled(TextField)`
  padding: 0;
`;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  padding: 0;
`;

const StyledListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  line-height: 1.3;
`;

const LabelText = styled(Text)`
  font-weight: bold;
  color: ${p => p.theme.subText};
`;

const ListItemSubText = styled(LabelText)`
  font-weight: normal;
  padding-left: ${space(4)};
`;

const InputGroup = styled('div')`
  padding-left: ${space(4)};
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const ScheduleGroupInputs = styled('div')<{interval?: boolean}>`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: ${p => p.interval && 'auto'} 1fr 2fr;
`;

const CronstrueText = styled(LabelText)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: auto / span 2;
`;
