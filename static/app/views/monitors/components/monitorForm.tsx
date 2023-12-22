import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import AlertLink from 'sentry/components/alertLink';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form, {FormProps} from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import ExternalLink from 'sentry/components/links/externalLink';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Text from 'sentry/components/text';
import {timezoneOptions} from 'sentry/data/timezones';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import slugify from 'sentry/utils/slugify';
import commonTheme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {crontabAsText, getScheduleIntervals} from 'sentry/views/monitors/utils';

import {
  IntervalConfig,
  Monitor,
  MonitorConfig,
  MonitorType,
  ScheduleType,
} from '../types';

const SCHEDULE_OPTIONS: SelectValue<string>[] = [
  {value: ScheduleType.CRONTAB, label: t('Crontab')},
  {value: ScheduleType.INTERVAL, label: t('Interval')},
];

export const DEFAULT_MONITOR_TYPE = 'cron_job';
export const DEFAULT_CRONTAB = '0 0 * * *';

// Maps the value from the SentryMemberTeamSelectorField -> the expected alert
// rule key and vice-versa.
//
// XXX(epurkhiser): For whatever reason the rules API wants the team and member
// to be capitalized.
const RULE_TARGET_MAP = {team: 'Team', member: 'Member'} as const;
const RULES_SELECTOR_MAP = {Team: 'team', Member: 'member'} as const;

// In minutes
export const DEFAULT_MAX_RUNTIME = 30;
export const DEFAULT_CHECKIN_MARGIN = 1;
const CHECKIN_MARGIN_MINIMUM = 1;
const TIMEOUT_MINIMUM = 1;

type Props = {
  apiEndpoint: string;
  apiMethod: FormProps['apiMethod'];
  onSubmitSuccess: FormProps['onSubmitSuccess'];
  monitor?: Monitor;
  submitLabel?: string;
};

interface TransformedData extends Partial<Omit<Monitor, 'config' | 'alertRule'>> {
  alertRule?: Partial<Monitor['alertRule']>;
  config?: Partial<Monitor['config']>;
}

/**
 * Transform sub-fields for what the API expects
 */
export function transformMonitorFormData(_data: Record<string, any>, model: FormModel) {
  const schedType = model.getValue('config.schedule_type');
  // Remove interval fields if the monitor schedule is crontab
  const filteredFields = model.fields
    .toJSON()
    .filter(
      ([k, _v]) =>
        (schedType === ScheduleType.CRONTAB &&
          k !== 'config.schedule.interval' &&
          k !== 'config.schedule.frequency') ||
        schedType === ScheduleType.INTERVAL
    );

  const result = filteredFields.reduce<TransformedData>((data, [k, v]) => {
    data.config ??= {};
    data.alertRule ??= {};

    if (k === 'alertRule.targets') {
      const alertTargets = (v as string[] | undefined)?.map(item => {
        // See SentryMemberTeamSelectorField to understand why these are strings
        const [type, id] = item.split(':');

        const targetType = RULE_TARGET_MAP[type];

        return {targetType, targetIdentifier: Number(id)};
      });

      data.alertRule.targets = alertTargets;
      return data;
    }

    if (k === 'alertRule.environment') {
      const environment = v === '' ? undefined : (v as string);
      data.alertRule.environment = environment;
      return data;
    }

    if (k === 'config.schedule.frequency' || k === 'config.schedule.interval') {
      if (!Array.isArray(data.config.schedule)) {
        data.config.schedule = [1, 'hour'];
      }
    }

    if (Array.isArray(data.config.schedule) && k === 'config.schedule.frequency') {
      data.config.schedule[0] = parseInt(v as string, 10);
      return data;
    }

    if (Array.isArray(data.config.schedule) && k === 'config.schedule.interval') {
      data.config.schedule[1] = v as IntervalConfig['schedule'][1];
      return data;
    }

    if (k.startsWith('config.')) {
      data.config[k.substring(7)] = v;
      return data;
    }

    data[k] = v;
    return data;
  }, {});

  // If targets are not specified, don't send alert rule config to backend
  if (!result.alertRule?.targets) {
    result.alertRule = undefined;
  }

  return result;
}

/**
 * Transform config field errors from the error response
 */
export function mapMonitorFormErrors(responseJson?: any) {
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
  const form = useRef(
    new FormModel({
      transformData: transformMonitorFormData,
      mapFormErrors: mapMonitorFormErrors,
    })
  );
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  function formDataFromConfig(type: MonitorType, config: MonitorConfig) {
    const rv = {};
    switch (type) {
      case 'cron_job':
        rv['config.schedule_type'] = config.schedule_type;
        rv['config.checkin_margin'] = config.checkin_margin;
        rv['config.max_runtime'] = config.max_runtime;
        rv['config.failure_issue_threshold'] = config.failure_issue_threshold;
        rv['config.recovery_threshold'] = config.recovery_threshold;

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

  const alertRuleTarget = monitor?.alertRule?.targets.map(
    target => `${RULES_SELECTOR_MAP[target.targetType]}:${target.targetIdentifier}`
  );

  const envOptions = selectedProject?.environments.map(e => ({value: e, label: e})) ?? [];
  const alertRuleEnvs = [
    {
      label: 'All Environments',
      value: '',
    },
    ...envOptions,
  ];

  const hasIssuePlatform = organization.features.includes('issue-platform');

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
              'alertRule.targets': alertRuleTarget,
              'alertRule.environment': monitor.alertRule?.environment,
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
        <ListItemSubText>{t('The name will show up in notifications.')}</ListItemSubText>
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
        <StyledListItem>{t('Set your schedule')}</StyledListItem>
        <ListItemSubText>
          {tct('You can use [link:the crontab syntax] or our interval schedule.', {
            link: <ExternalLink href="https://en.wikipedia.org/wiki/Cron" />,
          })}
        </ListItemSubText>
        <InputGroup>
          {monitor !== undefined && (
            <StyledAlert type="info">
              {t(
                'Any changes you make to the execution schedule will only be applied after the next expected check-in.'
              )}
            </StyledAlert>
          )}
          <StyledSelectField
            name="config.schedule_type"
            options={SCHEDULE_OPTIONS}
            defaultValue={ScheduleType.CRONTAB}
            orientInline
            required
            stacked
            inline={false}
          />
          <Observer>
            {() => {
              const scheduleType = form.current.getValue('config.schedule_type');

              const parsedSchedule =
                scheduleType === 'crontab'
                  ? crontabAsText(
                      form.current.getValue('config.schedule')?.toString() ?? ''
                    )
                  : null;

              if (scheduleType === 'crontab') {
                return (
                  <MultiColumnInput columns="1fr 2fr">
                    <StyledTextField
                      name="config.schedule"
                      placeholder="* * * * *"
                      defaultValue={DEFAULT_CRONTAB}
                      css={{input: {fontFamily: commonTheme.text.familyMono}}}
                      required
                      stacked
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
                  </MultiColumnInput>
                );
              }
              if (scheduleType === 'interval') {
                return (
                  <MultiColumnInput columns="auto 1fr 2fr">
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
                      options={getScheduleIntervals(
                        Number(form.current.getValue('config.schedule.frequency') ?? 1)
                      )}
                      defaultValue="day"
                      required
                      stacked
                      inline={false}
                    />
                  </MultiColumnInput>
                );
              }
              return null;
            }}
          </Observer>
        </InputGroup>
        <StyledListItem>{t('Set margins')}</StyledListItem>
        <ListItemSubText>
          {t('Configure when we mark your monitor as failed or missed.')}
        </ListItemSubText>
        <InputGroup>
          <Panel>
            <PanelBody>
              <NumberField
                name="config.checkin_margin"
                min={CHECKIN_MARGIN_MINIMUM}
                placeholder={tn(
                  'Defaults to %s minute',
                  'Defaults to %s minutes',
                  DEFAULT_CHECKIN_MARGIN
                )}
                help={t('Number of minutes before a check-in is considered missed.')}
                label={t('Grace Period')}
              />
              <NumberField
                name="config.max_runtime"
                min={TIMEOUT_MINIMUM}
                placeholder={tn(
                  'Defaults to %s minute',
                  'Defaults to %s minutes',
                  DEFAULT_MAX_RUNTIME
                )}
                help={t(
                  'Number of a minutes before an in-progress check-in is marked timed out.'
                )}
                label={t('Max Runtime')}
              />
            </PanelBody>
          </Panel>
        </InputGroup>
        {hasIssuePlatform && (
          <Fragment>
            <StyledListItem>{t('Set thresholds')}</StyledListItem>
            <ListItemSubText>
              {t('Configure when an issue is created or resolved.')}
            </ListItemSubText>
            <InputGroup>
              <Panel>
                <PanelBody>
                  <NumberField
                    name="config.failure_issue_threshold"
                    min={1}
                    placeholder="1"
                    help={t(
                      'Create a new issue when this many consecutive missed or error check-ins are processed.'
                    )}
                    label={t('Failure Tolerance')}
                  />
                  <NumberField
                    name="config.recovery_threshold"
                    min={1}
                    placeholder="1"
                    help={t(
                      'Resolve the issue when this many consecutive healthy check-ins are processed.'
                    )}
                    label={t('Recovery Tolerance')}
                  />
                </PanelBody>
              </Panel>
            </InputGroup>
          </Fragment>
        )}
        <StyledListItem>{t('Notifications')}</StyledListItem>
        <ListItemSubText>
          {t('Configure who to notify upon issue creation and when.')}
        </ListItemSubText>
        <InputGroup>
          <Panel>
            <PanelBody>
              {monitor?.config.alert_rule_id && (
                <AlertLink
                  priority="muted"
                  to={normalizeUrl(
                    `/alerts/rules/${monitor.project.slug}/${monitor.config.alert_rule_id}/`
                  )}
                  withoutMarginBottom
                >
                  {t('Customize this monitors notification configuration in Alerts')}
                </AlertLink>
              )}
              <SentryMemberTeamSelectorField
                label={t('Notify')}
                help={t('Send notifications to a member or team.')}
                name="alertRule.targets"
                multiple
                menuPlacement="auto"
              />
              <Observer>
                {() => {
                  const selectedAssignee = form.current.getValue('alertRule.targets');
                  // Check for falsey value or empty array value
                  const disabled = !selectedAssignee || !selectedAssignee.toString();

                  return (
                    <SelectField
                      label={t('Environment')}
                      help={t('Only receive notifications from a specific environment.')}
                      name="alertRule.environment"
                      options={alertRuleEnvs}
                      disabled={disabled}
                      menuPlacement="auto"
                      defaultValue=""
                      disabledReason={t(
                        'Please select which teams or members to notify first.'
                      )}
                    />
                  );
                }}
              </Observer>
            </PanelBody>
          </Panel>
        </InputGroup>
      </StyledList>
    </Form>
  );
}

export default MonitorForm;

const StyledList = styled(List)`
  width: 800px;
`;

const StyledAlert = styled(Alert)`
  margin-bottom: 0;
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

const StyledListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  line-height: 1.3;
`;

const LabelText = styled(Text)`
  font-weight: bold;
  color: ${p => p.theme.subText};
`;

const ListItemSubText = styled(Text)`
  padding-left: ${space(4)};
  color: ${p => p.theme.subText};
`;

const InputGroup = styled('div')`
  padding-left: ${space(4)};
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const MultiColumnInput = styled('div')<{columns?: string}>`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: ${p => p.columns};
`;

const CronstrueText = styled(LabelText)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: auto / span 2;
`;
