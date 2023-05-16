import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import AlertLink from 'sentry/components/alertLink';
import {RadioOption} from 'sentry/components/forms/controls/radioGroup';
import NumberField from 'sentry/components/forms/fields/numberField';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Text from 'sentry/components/text';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import slugify from 'sentry/utils/slugify';
import commonTheme from 'sentry/utils/theme';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
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
const DEFAULT_CRONTAB = '0 0 * * *';

export const DEFAULT_MAX_RUNTIME = 30;

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

/**
 * Transform config field values into the config object
 */
function transformData(_data: Record<string, any>, model: FormModel) {
  return model.fields.toJSON().reduce<TransformedData>((data, [k, v]) => {
    if (k === 'alertRule') {
      const alertTargets = (v as string[] | undefined)?.map(item => {
        // See SentryMemberTeamSelectorField to understand why these are strings
        const [type, id] = item.split(':');

        // XXX(epurkhiser): For whateve reason the rules API wants the team and
        // mebmer to be capitalized.
        const targetType = {team: 'Team', member: 'Member'}[type];

        return {targetType, targetIdentifier: id};
      });

      data[k] = {targets: alertTargets};
      return data;
    }

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

    data.config[k.substring(7)] = v;
    return data;
  }, {});
}

/**
 * Transform config field errors from the error response
 */
function mapFormErrors(responseJson?: any) {
  if (responseJson.config === undefined) {
    return responseJson;
  }

  // Bring nested config entries to the top
  const {config, ...responseRest} = responseJson;
  const configErrors = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [`config.${key}`, value])
  );

  return {...responseRest, ...configErrors};
}

function MonitorForm({
  monitor,
  submitLabel,
  apiEndpoint,
  apiMethod,
  onSubmitSuccess,
}: Props) {
  const form = useRef(new FormModel({transformData, mapFormErrors}));
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const [crontabInput, setCrontabInput] = useState(
    monitor?.config.schedule_type === ScheduleType.CRONTAB
      ? monitor?.config.schedule
      : DEFAULT_CRONTAB
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

  const isSuperuser = isActiveSuperuser();
  const filteredProjects = projects.filter(project => isSuperuser || project.isMember);

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
              slug: monitor.slug,
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
          {monitor && (
            <StyledTextField
              name="slug"
              help={tct(
                'The [strong:monitor-slug] is used to uniquely identify your monitor within your organization. Changing this slug will require updates to any instrumented check-in calls.',
                {strong: <strong />}
              )}
              placeholder={t('monitor-slug')}
              required
              stacked
              inline={false}
              transformInput={slugify}
            />
          )}
          <StyledSentryProjectSelectorField
            name="project"
            projects={filteredProjects}
            placeholder={t('Choose Project')}
            disabled={!!monitor}
            disabledReason={t('Existing monitors cannot be moved between projects')}
            valueIsSlug
            required
            stacked
            inline={false}
          />
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
          {monitor !== undefined && (
            <Alert type="info">
              {t(
                'Any changes you make to the execution schedule will only be applied after the next expected check-in.'
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
                      placeholder="* * * * *"
                      defaultValue={DEFAULT_CRONTAB}
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
                      defaultValue="1"
                      required
                      stacked
                      inline={false}
                    />
                    <StyledSelectField
                      name="config.schedule.interval"
                      options={getIntervals(
                        Number(form.current.getValue('config.schedule.frequency') ?? 1)
                      )}
                      defaultValue="day"
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
            placeholder="Defaults to 0 minutes"
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
            placeholder={`Defaults to ${DEFAULT_MAX_RUNTIME} minutes`}
            stacked
            inline={false}
          />
        </InputGroup>
        {(monitor === undefined || monitor.config.alert_rule_id) && (
          <Fragment>
            <StyledListItem>{t('Notify members')}</StyledListItem>
            <ListItemSubText>
              {t(
                'Tell us who to notify when a check-in reaches the thresholds above or has an error. You can send notifications to members or teams.'
              )}
            </ListItemSubText>
            <InputGroup>
              {monitor === undefined ? (
                <StyledSentryMemberTeamSelectorField
                  name="alertRule"
                  multiple
                  stacked
                  inline={false}
                />
              ) : (
                <AlertLink
                  priority="muted"
                  to={normalizeUrl(
                    `/alerts/rules/${monitor.project.slug}/${monitor.config.alert_rule_id}/`
                  )}
                >
                  {t('Customize this monitors notification configuration in Alerts')}
                </AlertLink>
              )}
            </InputGroup>
          </Fragment>
        )}
      </StyledList>
    </Form>
  );
}

export default MonitorForm;

const StyledList = styled(List)`
  width: 600px;
`;

const StyledNumberField = styled(NumberField)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
`;

const StyledTextField = styled(TextField)`
  padding: 0;
`;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  padding: 0;
`;

const StyledSentryMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
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
