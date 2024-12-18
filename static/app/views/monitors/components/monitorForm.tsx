import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import Alert from 'sentry/components/alert';
import AlertLink from 'sentry/components/alertLink';
import FieldWrapper from 'sentry/components/forms/fieldGroup/fieldWrapper';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
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
import type {SelectValue} from 'sentry/types/core';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import slugify from 'sentry/utils/slugify';
import commonTheme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {getScheduleIntervals} from 'sentry/views/monitors/utils';
import {crontabAsText} from 'sentry/views/monitors/utils/crontabAsText';

import type {IntervalConfig, Monitor, MonitorConfig, MonitorType} from '../types';
import {ScheduleType} from '../types';

import {platformsWithGuides} from './monitorQuickStartGuide';

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
const RULE_TARGET_MAP = {team: 'Team', user: 'Member'} as const;
const RULES_SELECTOR_MAP = {Team: 'team', Member: 'user'} as const;

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
  const schedType = model.getValue('config.scheduleType');
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
  const organization = useOrganization();
  const form = useRef(
    new FormModel({
      transformData: transformMonitorFormData,
      mapFormErrors: mapMonitorFormErrors,
    })
  );
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  function formDataFromConfig(type: MonitorType, config: MonitorConfig) {
    const rv: Record<string, MonitorConfig[keyof MonitorConfig]> = {};
    switch (type) {
      case 'cron_job':
        rv['config.scheduleType'] = config.schedule_type;
        rv['config.checkinMargin'] = config.checkin_margin;
        rv['config.maxRuntime'] = config.max_runtime;
        rv['config.failureIssueThreshold'] = config.failure_issue_threshold;
        rv['config.recoveryThreshold'] = config.recovery_threshold;

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

  const selectedProjectId = monitor?.project.id ?? selection.projects[0];
  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId.toString())
    : null;

  const isSuperuser = isActiveSuperuser();
  const filteredProjects = projects.filter(project => isSuperuser || project.isMember);

  const alertRuleTarget = monitor?.alertRule?.targets.map(
    target => `${RULES_SELECTOR_MAP[target.targetType]}:${target.targetIdentifier}`
  );

  const owner = monitor?.owner ? `${monitor.owner.type}:${monitor.owner.id}` : null;

  const envOptions = selectedProject?.environments.map(e => ({value: e, label: e})) ?? [];
  const alertRuleEnvs = [
    {
      label: 'All Environments',
      value: '',
    },
    ...envOptions,
  ];

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
              owner,
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
        <InputGroup noPadding>
          <TextField
            name="name"
            label={t('Name')}
            hideLabel
            placeholder={t('My Cron Job')}
            required
            stacked
            inline={false}
          />
          {monitor && (
            <TextField
              name="slug"
              label={t('Slug')}
              hideLabel
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
          <SentryProjectSelectorField
            name="project"
            label={t('Project')}
            hideLabel
            groupProjects={project =>
              platformsWithGuides.includes(project.platform) ? 'suggested' : 'other'
            }
            groups={[
              {key: 'suggested', label: t('Suggested Projects')},
              {key: 'other', label: t('Other Projects')},
            ]}
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
        <InputGroup noPadding>
          {monitor !== undefined && (
            <StyledAlert type="info">
              {t(
                'Any changes you make to the execution schedule will only be applied after the next expected check-in.'
              )}
            </StyledAlert>
          )}
          <SelectField
            name="config.scheduleType"
            label={t('Schedule Type')}
            hideLabel
            options={SCHEDULE_OPTIONS}
            defaultValue={ScheduleType.CRONTAB}
            orientInline
            required
            stacked
            inline={false}
          />
          <Observer>
            {() => {
              const scheduleType = form.current.getValue('config.scheduleType');

              const parsedSchedule =
                scheduleType === 'crontab'
                  ? crontabAsText(
                      form.current.getValue('config.schedule')?.toString() ?? ''
                    )
                  : null;

              if (scheduleType === 'crontab') {
                return (
                  <MultiColumnInput columns="1fr 2fr">
                    <TextField
                      name="config.schedule"
                      label={t('Crontab Schedule')}
                      hideLabel
                      placeholder="* * * * *"
                      defaultValue={DEFAULT_CRONTAB}
                      css={{input: {fontFamily: commonTheme.text.familyMono}}}
                      required
                      stacked
                      inline={false}
                    />
                    <SelectField
                      name="config.timezone"
                      label={t('Timezone')}
                      hideLabel
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
                    <NumberField
                      name="config.schedule.frequency"
                      label={t('Interval Frequency')}
                      hideLabel
                      placeholder="e.g. 1"
                      defaultValue="1"
                      min={1}
                      required
                      stacked
                      inline={false}
                    />
                    <SelectField
                      name="config.schedule.interval"
                      label={t('Interval Type')}
                      hideLabel
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
                name="config.checkinMargin"
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
                name="config.maxRuntime"
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
        <Fragment>
          <StyledListItem>{t('Set thresholds')}</StyledListItem>
          <ListItemSubText>
            {t('Configure when an issue is created or resolved.')}
          </ListItemSubText>
          <InputGroup>
            <Panel>
              <PanelBody>
                <NumberField
                  name="config.failureIssueThreshold"
                  min={1}
                  placeholder="1"
                  help={t(
                    'Create a new issue when this many consecutive missed or error check-ins are processed.'
                  )}
                  label={t('Failure Tolerance')}
                />
                <NumberField
                  name="config.recoveryThreshold"
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
        <StyledListItem>{t('Set Owner')}</StyledListItem>
        <ListItemSubText>
          {t(
            'Choose a team or member as the monitor owner. Issues created will be automatically assigned to the owner.'
          )}
        </ListItemSubText>
        <InputGroup>
          <Panel>
            <PanelBody>
              <SentryMemberTeamSelectorField
                name="owner"
                label={t('Owner')}
                help={t('Automatically assign issues to a team or user.')}
                menuPlacement="auto"
              />
            </PanelBody>
          </Panel>
        </InputGroup>
        <StyledListItem>{t('Notifications')}</StyledListItem>
        <ListItemSubText>
          {t('Configure who to notify upon issue creation and when.')}
        </ListItemSubText>
        <InputGroup>
          {monitor?.config.alert_rule_id && (
            <AlertLink
              priority="muted"
              to={`/organizations/${organization.slug}/alerts/rules/${monitor.project.slug}/${monitor.config.alert_rule_id}/`}
              withoutMarginBottom
            >
              {t('Customize this monitors notification configuration in Alerts')}
            </AlertLink>
          )}
          <Panel>
            <PanelBody>
              <Observer>
                {() => {
                  const projectSlug = form.current.getValue('project')?.toString();
                  return (
                    <SentryMemberTeamSelectorField
                      label={t('Notify')}
                      help={t('Send notifications to a member or team.')}
                      name="alertRule.targets"
                      memberOfProjectSlugs={projectSlug ? [projectSlug] : undefined}
                      multiple
                      menuPlacement="auto"
                    />
                  );
                }}
              </Observer>
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

const StyledListItem = styled(ListItem)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.3;
`;

const LabelText = styled(Text)`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const ListItemSubText = styled(Text)`
  padding-left: ${space(4)};
  color: ${p => p.theme.subText};
`;

const InputGroup = styled('div')<{noPadding?: boolean}>`
  padding-left: ${space(4)};
  margin-top: ${space(1)};
  margin-bottom: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  ${FieldWrapper} {
    ${p => p.noPadding && `padding: 0;`};
  }
`;

const MultiColumnInput = styled('div')<{columns?: string}>`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: ${p => p.columns};
`;

const CronstrueText = styled(LabelText)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: auto / span 2;
`;
