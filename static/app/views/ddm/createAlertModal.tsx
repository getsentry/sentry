import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {AreaChart} from 'sentry/components/charts/areaChart';
import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import CircleIndicator from 'sentry/components/circleIndicator';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters, Project} from 'sentry/types';
import {parsePeriodToHours, statsPeriodToDays} from 'sentry/utils/dates';
import {
  formatMetricUsingFixedUnit,
  getDDMInterval,
  getFieldFromMetricsQuery as getAlertAggregate,
  MetricDisplayType,
  MetricsQuery,
} from 'sentry/utils/metrics';
import {formatMRIField, getUseCaseFromMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {useMetricsData} from 'sentry/utils/metrics/useMetricsData';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {AVAILABLE_TIME_PERIODS} from 'sentry/views/alerts/rules/metric/triggers/chart';
import {
  Dataset,
  EventTypes,
  TimePeriod,
  TimeWindow,
} from 'sentry/views/alerts/rules/metric/types';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getChartSeries} from 'sentry/views/ddm/widget';

interface FormState {
  environment: string | null;
  project: string | null;
}

function getInitialFormState(metricsQuery: MetricsQuery): FormState {
  const project =
    metricsQuery.projects.length === 1 ? metricsQuery.projects[0].toString() : null;
  const environment =
    metricsQuery.environments.length === 1 && project
      ? metricsQuery.environments[0]
      : null;

  return {
    project,
    environment,
  };
}

function getAlertPeriod(metricsQuery: MetricsQuery) {
  const {period, start, end} = metricsQuery.datetime;
  const inHours = statsPeriodToDays(period, start, end) * 24;

  switch (true) {
    case inHours <= 6:
      return TimePeriod.SIX_HOURS;
    case inHours <= 24:
      return TimePeriod.ONE_DAY;
    case inHours <= 3 * 24:
      return TimePeriod.THREE_DAYS;
    case inHours <= 7 * 24:
      return TimePeriod.SEVEN_DAYS;
    case inHours <= 14 * 24:
      return TimePeriod.FOURTEEN_DAYS;
    default:
      return TimePeriod.SEVEN_DAYS;
  }
}

const TIME_WINDOWS_TO_CHECK = [
  TimeWindow.ONE_MINUTE,
  TimeWindow.FIVE_MINUTES,
  TimeWindow.TEN_MINUTES,
  TimeWindow.FIFTEEN_MINUTES,
  TimeWindow.THIRTY_MINUTES,
  TimeWindow.ONE_HOUR,
  TimeWindow.TWO_HOURS,
  TimeWindow.FOUR_HOURS,
  TimeWindow.ONE_DAY,
];

export function getAlertInterval(metricsQuery, period: TimePeriod) {
  const useCase = getUseCaseFromMRI(metricsQuery.mri) ?? 'custom';
  const interval = getDDMInterval(metricsQuery.datetime, useCase);
  const inMinutes = parsePeriodToHours(interval) * 60;

  function toInterval(timeWindow: TimeWindow) {
    return `${timeWindow}m`;
  }

  for (let index = 0; index < TIME_WINDOWS_TO_CHECK.length; index++) {
    const timeWindow = TIME_WINDOWS_TO_CHECK[index];
    if (inMinutes <= timeWindow && AVAILABLE_TIME_PERIODS[timeWindow].includes(period)) {
      return toInterval(timeWindow);
    }
  }

  return toInterval(TimeWindow.ONE_HOUR);
}

interface Props extends ModalRenderProps {
  metricsQuery: MetricsQuery;
}

export function CreateAlertModal({Header, Body, Footer, metricsQuery}: Props) {
  const router = useRouter();
  const organization = useOrganization();
  const {projects} = useProjects();
  const [formState, setFormState] = useState<FormState>(() =>
    getInitialFormState(metricsQuery)
  );

  const selectedProject = projects.find(p => p.id === formState.project);
  const isFormValid = formState.project !== null;

  const alertPeriod = useMemo(() => getAlertPeriod(metricsQuery), [metricsQuery]);
  const alertInterval = useMemo(
    () => getAlertInterval(metricsQuery, alertPeriod),
    [metricsQuery, alertPeriod]
  );

  const aggregate = useMemo(() => getAlertAggregate(metricsQuery), [metricsQuery]);

  const {data, isLoading, refetch, isError} = useMetricsData(
    {
      mri: metricsQuery.mri,
      op: metricsQuery.op,
      projects: formState.project ? [parseInt(formState.project, 10)] : [],
      environments: formState.environment ? [formState.environment] : [],
      datetime: {period: alertPeriod} as PageFilters['datetime'],
      query: metricsQuery.query,
    },
    {
      interval: alertInterval,
    }
  );

  const chartSeries = useMemo(
    () =>
      data &&
      getChartSeries(data, {
        mri: metricsQuery.mri,
        displayType: MetricDisplayType.AREA,
        focusedSeries: undefined,
        groupBy: [],
        hoveredLegend: undefined,
      }),
    [data, metricsQuery.mri]
  );

  const projectOptions = useMemo(() => {
    const nonMemberProjects: Project[] = [];
    const memberProjects: Project[] = [];
    projects
      .filter(
        project =>
          metricsQuery.projects.length === 0 ||
          metricsQuery.projects.includes(parseInt(project.id, 10))
      )
      .forEach(project =>
        project.isMember ? memberProjects.push(project) : nonMemberProjects.push(project)
      );

    return [
      {
        label: t('My Projects'),
        options: memberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
      {
        label: t('All Projects'),
        options: nonMemberProjects.map(p => ({
          value: p.id,
          label: p.slug,
          leadingItems: <ProjectBadge project={p} avatarSize={16} hideName disableLink />,
        })),
      },
    ];
  }, [metricsQuery.projects, projects]);

  const environmentOptions = useMemo(
    () => [
      {
        value: null,
        label: t('All Environments'),
      },
      ...(selectedProject?.environments.map(env => ({
        value: env,
        label: env,
      })) ?? []),
    ],
    [selectedProject?.environments]
  );

  const handleSubmit = useCallback(() => {
    router.push(
      `/organizations/${organization.slug}/alerts/new/metric/?${qs.stringify({
        aggregate,
        query: `${metricsQuery.query} event.type:transaction`.trim(),
        createFromDiscover: true,
        dataset: Dataset.GENERIC_METRICS,
        interval: alertInterval,
        statsPeriod: alertPeriod,
        environment: formState.environment ?? undefined,
        project: selectedProject!.slug,
        referrer: 'ddm',
        // Event type also needs to be added to the query
        eventTypes: EventTypes.TRANSACTION,
      })}`
    );
  }, [
    router,
    aggregate,
    metricsQuery.query,
    organization.slug,
    alertInterval,
    alertPeriod,
    formState.environment,
    selectedProject,
  ]);

  const unit = parseMRI(metricsQuery.mri)?.unit ?? 'none';
  const operation = metricsQuery.op;
  const chartOptions = useMemo(() => {
    const bucketSize =
      (chartSeries?.[0]?.data[1]?.name ?? 0) - (chartSeries?.[0]?.data[0]?.name ?? 0);

    const formatters = {
      valueFormatter: value => formatMetricUsingFixedUnit(value, unit, operation),
      isGroupedByDate: true,
      bucketSize,
      showTimeInTooltip: true,
    };

    return {
      isGroupedByDate: true,
      height: 200,
      grid: {top: 20, bottom: 20, left: 15, right: 25},
      tooltip: {
        formatter: getFormatter(formatters),
      },
      yAxis: {
        axisLabel: {
          formatter: value => formatMetricUsingFixedUnit(value, unit, operation),
        },
      },
    };
  }, [chartSeries, operation, unit]);

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Create Alert')}</h4>
      </Header>
      <Body>
        <ContentWrapper>
          <SelectControl
            placeholder={t('Select a project')}
            options={projectOptions}
            value={formState.project}
            onChange={({value}) =>
              setFormState(prev => ({
                project: value,
                environment: projects
                  .find(p => p.id === value)
                  ?.environments.includes(prev.environment ?? '')
                  ? prev.environment
                  : null,
              }))
            }
          />
          <SelectControl
            placeholder={t('Select an environment')}
            options={environmentOptions}
            disabled={!selectedProject}
            value={formState.environment}
            onChange={({value}) => setFormState(prev => ({...prev, environment: value}))}
          />
          <div>
            {t(
              'Grouped series are not supported by alerts. This is a preview of the data the alert will use.'
            )}
          </div>

          <ChartPanel isLoading={isLoading}>
            <PanelBody withPadding>
              <ChartHeader>
                <HeaderTitleLegend>
                  {AlertWizardAlertNames.custom_metrics}
                </HeaderTitleLegend>
              </ChartHeader>
              <ChartFilters>
                <StyledCircleIndicator size={8} />
                <Tooltip
                  title={
                    <Fragment>
                      <Filters>{formatMRIField(aggregate)}</Filters>
                      {metricsQuery.query}
                    </Fragment>
                  }
                  isHoverable
                  skipWrapper
                  overlayStyle={{
                    maxWidth: '90vw',
                    lineBreak: 'anywhere',
                    textAlign: 'left',
                  }}
                  showOnlyOnOverflow
                >
                  <QueryFilters>
                    <Filters>{formatMRIField(aggregate)}</Filters>
                    {metricsQuery.query}
                  </QueryFilters>
                </Tooltip>
              </ChartFilters>
            </PanelBody>
            {isLoading && <StyledLoadingIndicator />}
            {isError && <LoadingError onRetry={refetch} />}
            {chartSeries && <AreaChart series={chartSeries} {...chartOptions} />}
          </ChartPanel>
        </ContentWrapper>
      </Body>
      <Footer>
        <Tooltip disabled={isFormValid} title={t('Please select a project')}>
          <Button priority="primary" disabled={!isFormValid} onClick={handleSubmit}>
            {t('Continue')}
          </Button>
        </Tooltip>
      </Footer>
    </Fragment>
  );
}

const ContentWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};
`;

const ChartPanel = styled(Panel)<{isLoading: boolean}>`
  ${p => p.isLoading && `opacity: 0.6;`}
`;

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const StyledCircleIndicator = styled(CircleIndicator)`
  background: ${p => p.theme.formText};
  height: ${space(1)};
  margin-right: ${space(0.5)};
`;

const ChartFilters = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.textColor};
  display: inline-grid;
  grid-template-columns: max-content auto;
  align-items: center;
`;

const Filters = styled('span')`
  margin-right: ${space(1)};
`;

const QueryFilters = styled('span')`
  min-width: 0px;
  ${p => p.theme.overflowEllipsis}
`;

// Totals to a height of 200px -> the height of the chart
const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: 64px;
  margin-top: 58px;
  margin-bottom: 78px;
`;
