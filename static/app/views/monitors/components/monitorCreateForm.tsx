import {Fragment, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {timezoneOptions} from 'sentry/data/timezones';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import commonTheme from 'sentry/utils/theme';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {Monitor} from 'sentry/views/monitors/types';
import {ScheduleType} from 'sentry/views/monitors/types';
import {getScheduleIntervals} from 'sentry/views/monitors/utils';
import {crontabAsText} from 'sentry/views/monitors/utils/crontabAsText';

import {MockTimelineVisualization} from './mockTimelineVisualization';
import {
  DEFAULT_CRONTAB,
  DEFAULT_MONITOR_TYPE,
  mapMonitorFormErrors,
  transformMonitorFormData,
} from './monitorForm';

const DEFAULT_SCHEDULE_CONFIG = {
  scheduleType: 'crontab',
  cronSchedule: DEFAULT_CRONTAB,
  intervalFrequency: '1',
  intervalUnit: 'day',
};

export default function MonitorCreateForm() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();
  const monitorCreationCallbacks = HookStore.get('callback:on-monitor-created');

  const form = useRef(
    new FormModel({
      transformData: transformMonitorFormData,
      mapFormErrors: mapMonitorFormErrors,
    })
  );

  const selectedProjectId = selection.projects[0];
  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId + '')
    : null;

  const isSuperuser = isActiveSuperuser();
  const filteredProjects = projects.filter(project => isSuperuser || project.isMember);

  function onCreateMonitor(data: Monitor) {
    const endpointOptions = {
      query: {
        project: selection.projects,
        environment: selection.environments,
      },
    };
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${organization.slug}/crons/${data.project.slug}/${data.slug}/`,
        query: endpointOptions.query,
      })
    );
    monitorCreationCallbacks.map(cb => cb(organization));
  }

  function changeScheduleType(type: ScheduleType) {
    form.current.setValue('config.scheduleType', type);
  }

  return (
    <Form
      allowUndo
      requireChanges
      apiEndpoint={`/organizations/${organization.slug}/monitors/`}
      apiMethod="POST"
      model={form.current}
      initialData={{
        project: selectedProject ? selectedProject.slug : null,
        type: DEFAULT_MONITOR_TYPE,
        'config.scheduleType': DEFAULT_SCHEDULE_CONFIG.scheduleType,
      }}
      onSubmitSuccess={onCreateMonitor}
      submitLabel={t('Create')}
    >
      <FieldContainer>
        <ProjectOwnerNameInputs>
          <StyledSentryProjectSelectorField
            name="project"
            projects={filteredProjects}
            placeholder={t('Choose Project')}
            disabledReason={t('Existing monitors cannot be moved between projects')}
            valueIsSlug
            required
            stacked
            inline={false}
          />
          <StyledSentryMemberTeamSelectorField
            name="owner"
            placeholder={t('Assign Ownership')}
            stacked
            inline={false}
            menuPlacement="auto"
          />
          <StyledTextField
            name="name"
            placeholder={t('My Cron Job')}
            required
            stacked
            inline={false}
          />
        </ProjectOwnerNameInputs>
        <LabelText>{t('SCHEDULE')}</LabelText>
        <ScheduleOptions>
          <Observer>
            {() => {
              const currScheduleType = form.current.getValue('config.scheduleType');
              const selectedCrontab = currScheduleType === ScheduleType.CRONTAB;
              const parsedSchedule = form.current.getError('config.schedule')
                ? null
                : crontabAsText(
                    form.current.getValue('config.schedule')?.toString() ?? ''
                  );

              return (
                <Fragment>
                  <SchedulePanel
                    highlighted={selectedCrontab}
                    onClick={() => changeScheduleType(ScheduleType.CRONTAB)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>{t('Crontab Schedule')}</ScheduleLabel>
                      <CrontabInputs>
                        <StyledTextField
                          name="config.schedule"
                          placeholder="* * * * *"
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.cronSchedule}
                          css={{input: {fontFamily: commonTheme.text.familyMono}}}
                          required={selectedCrontab}
                          stacked
                          inline={false}
                          hideControlState={!selectedCrontab}
                        />
                        <StyledSelectField
                          name="config.timezone"
                          defaultValue="UTC"
                          options={timezoneOptions}
                          required={selectedCrontab}
                          stacked
                          inline={false}
                        />
                        <CronstrueText>
                          {parsedSchedule ?? t('(invalid schedule)')}
                        </CronstrueText>
                      </CrontabInputs>
                    </PanelBody>
                  </SchedulePanel>
                  <SchedulePanel
                    highlighted={!selectedCrontab}
                    onClick={() => changeScheduleType(ScheduleType.INTERVAL)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>{t('Interval Schedule')}</ScheduleLabel>
                      <IntervalInputs>
                        <Label>{t('Every')}</Label>
                        <StyledNumberField
                          name="config.schedule.frequency"
                          placeholder="e.g. 1"
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.intervalFrequency}
                          required={!selectedCrontab}
                          stacked
                          inline={false}
                          hideControlState={selectedCrontab}
                        />
                        <StyledSelectField
                          name="config.schedule.interval"
                          options={getScheduleIntervals(
                            Number(
                              form.current.getValue('config.schedule.frequency') ?? 1
                            )
                          )}
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.intervalUnit}
                          required={!selectedCrontab}
                          stacked
                          inline={false}
                        />
                      </IntervalInputs>
                    </PanelBody>
                  </SchedulePanel>
                </Fragment>
              );
            }}
          </Observer>
        </ScheduleOptions>
        <Observer>
          {() => {
            const scheduleType = form.current.getValue('config.scheduleType');
            const cronSchedule = form.current.getValue('config.schedule');
            const timezone = form.current.getValue('config.timezone');
            const intervalFrequency = form.current.getValue('config.schedule.frequency');
            const intervalUnit = form.current.getValue('config.schedule.interval');

            const schedule = {
              scheduleType,
              timezone,
              cronSchedule,
              intervalFrequency,
              intervalUnit,
            };

            return <MockTimelineVisualization schedule={schedule} />;
          }}
        </Observer>
      </FieldContainer>
    </Form>
  );
}

const FieldContainer = styled('div')`
  max-width: 800px;
`;

const SchedulePanel = styled(Panel)<{highlighted: boolean}>`
  border-radius: 0 ${space(0.75)} ${space(0.75)} 0;

  ${p =>
    p.highlighted
      ? css`
          border: 2px solid ${p.theme.purple300};
        `
      : css`
          padding: 1px;
        `};

  &:first-child {
    border-radius: ${space(0.75)} 0 0 ${space(0.75)};
  }
`;

const ScheduleLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  margin-bottom: ${space(2)};
`;

const Label = styled('div')`
  font-weight: ${p => p.theme.fontWeightBold};
  color: ${p => p.theme.subText};
`;

const LabelText = styled(Label)`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const ScheduleOptions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

const MultiColumnInput = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(1)};
`;

const ProjectOwnerNameInputs = styled(MultiColumnInput)`
  grid-template-columns: 230px 230px 1fr;
`;

const CrontabInputs = styled(MultiColumnInput)`
  grid-template-columns: 1fr 1fr;
`;

const IntervalInputs = styled(MultiColumnInput)`
  grid-template-columns: auto 1fr 2fr;
`;

const CronstrueText = styled(LabelText)`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: auto / span 2;
`;

const StyledNumberField = styled(NumberField)`
  padding: 0;
`;

const StyledSelectField = styled(SelectField)`
  padding: 0;
`;

const StyledSentryMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
  padding: 0;
`;

const StyledTextField = styled(TextField)`
  padding: 0;
`;

const StyledSentryProjectSelectorField = styled(SentryProjectSelectorField)`
  padding: 0;
`;
