import {Fragment, useEffect, useRef, useState} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {Observer} from 'mobx-react';

import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import SentryProjectSelectorField from 'sentry/components/forms/fields/sentryProjectSelectorField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel, {FieldValue} from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import Placeholder from 'sentry/components/placeholder';
import {timezoneOptions} from 'sentry/data/timezones';
import {IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useApiQuery} from 'sentry/utils/queryClient';
import commonTheme from 'sentry/utils/theme';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {
  DEFAULT_CRONTAB,
  DEFAULT_MONITOR_TYPE,
  mapMonitorFormErrors,
  transformMonitorFormData,
} from 'sentry/views/monitors/components/monitorForm';
import {MockCheckInTimeline} from 'sentry/views/monitors/components/overviewTimeline/checkInTimeline';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {TimelinePlaceholder} from 'sentry/views/monitors/components/overviewTimeline/timelinePlaceholder';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {Monitor, ScheduleType} from 'sentry/views/monitors/types';
import {crontabAsText, getScheduleIntervals} from 'sentry/views/monitors/utils';

const NUM_SAMPLE_TICKS = 9;

interface ScheduleConfig {
  cronSchedule?: FieldValue;
  intervalFrequency?: FieldValue;
  intervalUnit?: FieldValue;
  scheduleType?: FieldValue;
}

function isValidConfig(schedule: ScheduleConfig) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  return !!(
    (scheduleType === ScheduleType.CRONTAB && cronSchedule) ||
    (scheduleType === ScheduleType.INTERVAL && intervalFrequency && intervalUnit)
  );
}

const DEFAULT_SCHEDULE_CONFIG = {
  scheduleType: 'crontab',
  cronSchedule: DEFAULT_CRONTAB,
  intervalFrequency: '1',
  intervalUnit: 'day',
};

interface Props {
  onError: (RequestError) => void;
  schedule: ScheduleConfig;
}

function MockTimelineVisualization({schedule, onError}: Props) {
  const {scheduleType, cronSchedule, intervalFrequency, intervalUnit} = schedule;
  const organization = useOrganization();

  const query = {
    num_ticks: NUM_SAMPLE_TICKS,
    schedule_type: scheduleType,
    schedule:
      scheduleType === 'interval' ? [intervalFrequency, intervalUnit] : cronSchedule,
  };

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const sampleDataQueryKey = [
    `/organizations/${organization.slug}/monitors-schedule-data/`,
    {query},
  ] as const;
  const {data, isLoading, isError, error} = useApiQuery<number[]>(sampleDataQueryKey, {
    staleTime: 0,
    enabled: isValidConfig(schedule),
    retry: false,
  });

  const errorMessage =
    isError || !isValidConfig(schedule)
      ? error?.responseJSON?.schedule ?? t('Invalid Schedule')
      : null;

  useEffect(() => {
    onError(errorMessage);
  }, [errorMessage, onError]);

  const mockTimestamps = data?.map(ts => new Date(ts * 1000));
  const start = mockTimestamps?.[0];
  const end = mockTimestamps?.[mockTimestamps.length - 1];
  const timeWindowConfig =
    start && end ? getConfigFromTimeRange(start, end, timelineWidth) : undefined;

  return (
    <TimelineContainer>
      <TimelineWidthTracker ref={elementRef} />
      {isLoading || !start || !end || !timeWindowConfig || !mockTimestamps ? (
        <Fragment>
          {/* TODO(davidenwang): Improve loading placeholder */}
          <Placeholder height="40px" />
          {errorMessage ? <Placeholder height="100px" /> : <TimelinePlaceholder />}
        </Fragment>
      ) : (
        <Fragment>
          <StyledGridLineTimeLabels
            timeWindowConfig={timeWindowConfig}
            start={start}
            end={end}
            width={timelineWidth}
          />
          <StyledGridLineOverlay
            showCursor={!isLoading}
            timeWindowConfig={timeWindowConfig}
            start={start}
            end={end}
            width={timelineWidth}
          />
          <MockCheckInTimeline
            width={timelineWidth}
            mockTimestamps={mockTimestamps.slice(1, mockTimestamps.length - 1)}
            start={start}
            end={end}
            timeWindowConfig={timeWindowConfig}
          />
        </Fragment>
      )}
    </TimelineContainer>
  );
}

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 40px 100px;
  align-items: center;
`;

const StyledGridLineTimeLabels = styled(GridLineTimeLabels)`
  grid-column: 0;
`;

const StyledGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 0;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;

export default function MonitorCreateForm() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {selection} = usePageFilters();

  const [scheduleError, setScheduleError] = useState<string | null>(null);
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
        'config.schedule_type': DEFAULT_SCHEDULE_CONFIG.scheduleType,
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
        <ScheduleOptions>
          <Observer>
            {() => {
              const currScheduleType = form.current.getValue('config.schedule_type');
              const parsedSchedule = crontabAsText(
                form.current.getValue('config.schedule')?.toString() ?? ''
              );
              const selectedCrontab = currScheduleType === ScheduleType.CRONTAB;

              return (
                <Fragment>
                  <SchedulePanel
                    highlighted={selectedCrontab}
                    onClick={() => changeScheduleType(ScheduleType.CRONTAB)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>{t('Crontab Schedule')}</ScheduleLabel>
                      <MultiColumnInput columns="1fr 1fr">
                        <StyledTextField
                          name="config.schedule"
                          placeholder="* * * * *"
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.cronSchedule}
                          css={{input: {fontFamily: commonTheme.text.familyMono}}}
                          required={currScheduleType === ScheduleType.CRONTAB}
                          stacked
                          inline={false}
                        />
                        <StyledSelectField
                          name="config.timezone"
                          defaultValue="UTC"
                          options={timezoneOptions}
                          required={currScheduleType === ScheduleType.CRONTAB}
                          stacked
                          inline={false}
                        />
                        {currScheduleType === ScheduleType.CRONTAB && scheduleError ? (
                          <ErrorText>
                            <IconNot />
                            {scheduleError}
                          </ErrorText>
                        ) : (
                          <ScheduleDetailText>{parsedSchedule}</ScheduleDetailText>
                        )}
                      </MultiColumnInput>
                    </PanelBody>
                  </SchedulePanel>
                  <SchedulePanel
                    highlighted={currScheduleType === ScheduleType.INTERVAL}
                    onClick={() => changeScheduleType(ScheduleType.INTERVAL)}
                  >
                    <PanelBody withPadding>
                      <ScheduleLabel>{t('Interval Schedule')}</ScheduleLabel>
                      <MultiColumnInput columns="auto 1fr 2fr">
                        <Label>{t('Every')}</Label>
                        <StyledNumberField
                          name="config.schedule.frequency"
                          placeholder="e.g. 1"
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.intervalFrequency}
                          required={currScheduleType === ScheduleType.INTERVAL}
                          stacked
                          inline={false}
                        />
                        <StyledSelectField
                          name="config.schedule.interval"
                          options={getScheduleIntervals(
                            Number(
                              form.current.getValue('config.schedule.frequency') ?? 1
                            )
                          )}
                          defaultValue={DEFAULT_SCHEDULE_CONFIG.intervalUnit}
                          required={currScheduleType === ScheduleType.INTERVAL}
                          stacked
                          inline={false}
                        />
                        {currScheduleType === ScheduleType.INTERVAL && scheduleError && (
                          <ErrorText>
                            <IconNot />
                            {scheduleError}
                          </ErrorText>
                        )}
                      </MultiColumnInput>
                    </PanelBody>
                  </SchedulePanel>
                </Fragment>
              );
            }}
          </Observer>
        </ScheduleOptions>
        <Observer>
          {() => {
            const scheduleType = form.current.getValue('config.schedule_type');
            const cronSchedule = form.current.getValue('config.schedule');
            const intervalFrequency = form.current.getValue('config.schedule.frequency');
            const intervalUnit = form.current.getValue('config.schedule.interval');

            const schedule = {
              scheduleType,
              cronSchedule,
              intervalFrequency,
              intervalUnit,
            };

            return (
              <MockTimelineVisualization schedule={schedule} onError={setScheduleError} />
            );
          }}
        </Observer>
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
      border: 2px solid ${p.theme.purple300};
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

const ScheduleOptions = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

const MultiColumnInput = styled('div')<{columns?: string}>`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  grid-template-columns: ${p => p.columns};
`;

const ScheduleDetailText = styled(LabelText)`
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-family: ${p => p.theme.text.familyMono};
  grid-column: 1 / -1;
`;

const ErrorText = styled(ScheduleDetailText)`
  color: ${p => p.theme.error};
  display: flex;
  align-items: center;
  gap: ${space(1)};
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
