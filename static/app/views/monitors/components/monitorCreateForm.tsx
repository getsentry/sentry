import {Fragment, useRef} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {timezoneOptions} from 'sentry/data/timezones';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import commonTheme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DEFAULT_CRONTAB,
  DEFAULT_MONITOR_TYPE,
  getIntervals,
  mapFormErrors,
  transformData,
} from 'sentry/views/monitors/components/monitorForm';
import {Monitor, ScheduleType} from 'sentry/views/monitors/types';
import {crontabAsText} from 'sentry/views/monitors/utils';

export default function MonitorCreateForm() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const form = useRef(new FormModel({transformData, mapFormErrors}));

  const selectedProjectId = selection.projects[0];
  const selectedProject = selectedProjectId
    ? projects.find(p => p.id === selectedProjectId + '')
    : null;

  const isSuperuser = isActiveSuperuser();
  const filteredProjects = projects.filter(project => isSuperuser || project.isMember);

  function onCreateMonitor(data: Monitor) {
    const url = normalizeUrl(`/organizations/${organization.slug}/crons/${data.slug}/`);
    browserHistory.push(url);
  }

  function changeScheduleType(type: ScheduleType) {
    form.current.setValue('config.schedule_type', type);
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
        'config.schedule_type': ScheduleType.CRONTAB,
      }}
      onSubmitSuccess={onCreateMonitor}
      submitLabel={t('Next')}
    >
      <FieldContainer>
        <MultiColumnInput columns="250px 1fr">
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
          <StyledTextField
            name="name"
            placeholder={t('My Cron Job')}
            required
            stacked
            inline={false}
          />
        </MultiColumnInput>
        <LabelText>{t('SCHEDULE')}</LabelText>
        <ScheduleConfig>
          <Observer>
            {() => {
              const scheduleType = form.current.getValue('config.schedule_type');
              const parsedSchedule = crontabAsText(
                form.current.getValue('config.schedule')?.toString() ?? ''
              );
              return (
                <Fragment>
                  <SchedulePanel
                    highlighted={scheduleType === ScheduleType.CRONTAB}
                    onClick={() => changeScheduleType(ScheduleType.CRONTAB)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>Crontab Schedule</ScheduleLabel>
                      <MultiColumnInput columns="1fr 1fr">
                        <StyledTextField
                          name="config.schedule"
                          placeholder="* * * * *"
                          defaultValue={DEFAULT_CRONTAB}
                          css={{input: {fontFamily: commonTheme.text.familyMono}}}
                          required={scheduleType === ScheduleType.CRONTAB}
                          stacked
                          inline={false}
                        />
                        <StyledSelectField
                          name="config.timezone"
                          defaultValue="UTC"
                          options={timezoneOptions}
                          required={scheduleType === ScheduleType.CRONTAB}
                          stacked
                          inline={false}
                        />
                        <CronstrueText>{parsedSchedule}</CronstrueText>
                      </MultiColumnInput>
                    </PanelBody>
                  </SchedulePanel>
                  <SchedulePanel
                    highlighted={scheduleType === ScheduleType.INTERVAL}
                    onClick={() => changeScheduleType(ScheduleType.INTERVAL)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>Interval Schedule</ScheduleLabel>
                      <MultiColumnInput columns="auto 1fr 2fr">
                        <Label>{t('Every')}</Label>
                        <StyledNumberField
                          name="config.schedule.frequency"
                          placeholder="e.g. 1"
                          defaultValue="1"
                          required={scheduleType === ScheduleType.INTERVAL}
                          stacked
                          inline={false}
                        />
                        <StyledSelectField
                          name="config.schedule.interval"
                          options={getIntervals(
                            Number(
                              form.current.getValue('config.schedule.frequency') ?? 1
                            )
                          )}
                          defaultValue="day"
                          required={scheduleType === ScheduleType.INTERVAL}
                          stacked
                          inline={false}
                        />
                      </MultiColumnInput>
                    </PanelBody>
                  </SchedulePanel>
                </Fragment>
              );
            }}
          </Observer>
        </ScheduleConfig>
      </FieldContainer>
    </Form>
  );
}

const FieldContainer = styled('div')`
  width: 800px;
`;

const SchedulePanel = styled(Panel)<{highlighted: boolean}>`
  border-radius: 0 ${space(0.75)} ${space(0.75)} 0;

  ${p =>
    p.highlighted &&
    css`
      border: 2px solid purple;
    `};

  &:first-child {
    border-radius: ${space(0.75)} 0 0 ${space(0.75)};
  }
`;

const ScheduleLabel = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(2)};
`;

const Label = styled('div')`
  font-weight: bold;
  color: ${p => p.theme.subText};
`;

const LabelText = styled(Label)`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const ScheduleConfig = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
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
