import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import ChartZoom from 'sentry/components/charts/chartZoom';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import type {LineChartProps} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import ErrorBoundary from 'sentry/components/errorBoundary';
import NotAvailable from 'sentry/components/notAvailable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {Tooltip} from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SessionApiResponse} from 'sentry/types/organization';
import {SessionFieldWithOperation} from 'sentry/types/organization';
import type {ReleaseProject, ReleaseWithHealth} from 'sentry/types/release';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getAdoptionSeries, getCount, getCountAtIndex} from 'sentry/utils/sessions';
import {useLocation} from 'sentry/utils/useLocation';

import {
  ADOPTION_STAGE_LABELS,
  getReleaseBounds,
  getReleaseParams,
  isMobileRelease,
} from '../../../utils';
import {generateReleaseMarkLines, releaseMarkLinesLabels} from '../../utils';

const sessionsAxisIndex = 0;
const usersAxisIndex = 1;
const axisIndexToSessionsField = {
  [sessionsAxisIndex]: SessionFieldWithOperation.SESSIONS,
  [usersAxisIndex]: SessionFieldWithOperation.USERS,
};

type Props = {
  allSessions: SessionApiResponse | null;
  environment: string[];
  errored: boolean;
  loading: boolean;
  project: ReleaseProject;
  release: ReleaseWithHealth;
  releaseSessions: SessionApiResponse | null;
  reloading: boolean;
};

function ReleaseAdoption({
  release,
  project,
  environment,
  releaseSessions,
  allSessions,
  loading,
  reloading,
  errored,
}: Props) {
  const location = useLocation();
  const theme = useTheme();

  const hasUsers = !!getCount(releaseSessions?.groups, SessionFieldWithOperation.USERS);

  function getSeries() {
    if (!releaseSessions) {
      return [];
    }

    const sessionsMarkLines = generateReleaseMarkLines(
      release,
      project,
      theme,
      location,
      {
        hideLabel: true,
        axisIndex: sessionsAxisIndex,
      }
    );
    const sessionSeriesData = getAdoptionSeries(
      releaseSessions.groups,
      allSessions?.groups,
      releaseSessions.intervals,
      SessionFieldWithOperation.SESSIONS
    );
    // echarts doesn't seem to like displaying marklines when there's only one data point.
    // Usually, there is one data point because there is very little sessions data.
    const hasMultipleDataPoints = sessionSeriesData.length > 1;
    const series = [
      ...(hasMultipleDataPoints ? sessionsMarkLines : []),
      {
        seriesName: t('Sessions'),
        connectNulls: true,
        yAxisIndex: sessionsAxisIndex,
        xAxisIndex: sessionsAxisIndex,
        data: sessionSeriesData,
      },
    ];

    if (hasUsers) {
      const usersMarkLines = generateReleaseMarkLines(release, project, theme, location, {
        hideLabel: true,
        axisIndex: usersAxisIndex,
      });

      series.push(...usersMarkLines);
      series.push({
        seriesName: t('Users'),
        connectNulls: true,
        yAxisIndex: usersAxisIndex,
        xAxisIndex: usersAxisIndex,
        data: getAdoptionSeries(
          releaseSessions.groups,
          allSessions?.groups,
          releaseSessions.intervals,
          SessionFieldWithOperation.USERS
        ),
      });
    }

    return series;
  }

  const colors = theme.charts.getColorPalette(2) ?? [];

  const axisLineConfig = {
    scale: true,
    axisLine: {
      show: false,
    },
    axisTick: {
      show: false,
    },
    splitLine: {
      show: false,
    },
    max: 100,
    axisLabel: {
      formatter: (value: number) => `${value}%`,
      color: theme.chartLabel,
    },
  };

  const chartOptions: Omit<LineChartProps, 'series' | 'ref'> = {
    height: hasUsers ? 280 : 140,
    grid: [
      {
        top: '40px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
      {
        top: '180px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
    ],
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [sessionsAxisIndex, usersAxisIndex]}],
    },
    xAxes: Array.from(new Array(2)).map((_i, index) => ({
      gridIndex: index,
      type: 'time' as const,
      show: false,
    })),
    yAxes: [
      {
        gridIndex: sessionsAxisIndex,
        ...axisLineConfig,
      },
      {
        gridIndex: usersAxisIndex,
        ...axisLineConfig,
      },
    ],
    // utc: utc === 'true', //TODO(release-comparison)
    isGroupedByDate: true,
    showTimeInTooltip: true,
    colors: [colors[0], colors[1]] as string[],
    tooltip: {
      trigger: 'axis' as const,
      truncate: 80,
      valueFormatter: (value, label, seriesParams: any) => {
        const {axisIndex, dataIndex} = seriesParams || {};
        const absoluteCount = getCountAtIndex(
          releaseSessions?.groups,
          // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          axisIndexToSessionsField[axisIndex ?? 0],
          dataIndex ?? 0
        );

        return label && Object.values(releaseMarkLinesLabels).includes(label)
          ? ''
          : `<span>${formatAbbreviatedNumber(absoluteCount)} <span style="color: ${
              theme.textColor
            };margin-left: ${space(0.5)}">${value}%</span></span>`;
      },
      filter: (_, seriesParam: any) => {
        const {seriesName, axisIndex} = seriesParam;
        // do not display tooltips for "Users Adopted" marklines
        if (
          axisIndex === usersAxisIndex &&
          Object.values(releaseMarkLinesLabels).includes(seriesName)
        ) {
          return false;
        }
        return true;
      },
    },
  };

  const {
    statsPeriod: period,
    start,
    end,
    utc,
  } = getReleaseParams({
    location,
    releaseBounds: getReleaseBounds(release),
  });

  const adoptionStage = release.adoptionStages?.[project.slug]?.stage;
  const adoptionStageLabel = adoptionStage ? ADOPTION_STAGE_LABELS[adoptionStage] : null;
  const multipleEnvironments = environment.length === 0 || environment.length > 1;

  return (
    <div>
      {isMobileRelease(project.platform) && (
        <SidebarSection.Wrap>
          <SidebarSection.Title>
            {t('Adoption Stage')}
            {multipleEnvironments && (
              <QuestionTooltip
                position="top"
                title={t(
                  'See if a release has low adoption, been adopted by users, or replaced by another release. Select an environment above to view the stage this release is in.'
                )}
                size="sm"
              />
            )}
          </SidebarSection.Title>
          <SidebarSection.Content>
            {adoptionStageLabel && !multipleEnvironments ? (
              <div>
                <Tooltip title={adoptionStageLabel.tooltipTitle} isHoverable>
                  <Tag type={adoptionStageLabel.type}>{adoptionStageLabel.name}</Tag>
                </Tooltip>
                <AdoptionEnvironment>
                  {tct(`in [environment]`, {environment})}
                </AdoptionEnvironment>
              </div>
            ) : (
              <NotAvailableWrapper>
                <NotAvailable />
              </NotAvailableWrapper>
            )}
          </SidebarSection.Content>
        </SidebarSection.Wrap>
      )}
      <SidebarSection.Wrap>
        <RelativeBox>
          <ErrorBoundary mini>
            {!loading && (
              <ChartLabel top="0px">
                <SidebarSection.Title>
                  {t('Sessions Adopted')}
                  <TooltipWrapper>
                    <QuestionTooltip
                      position="top"
                      title={t(
                        'Adoption compares the sessions of a release with the total sessions for this project.'
                      )}
                      size="sm"
                    />
                  </TooltipWrapper>
                </SidebarSection.Title>
              </ChartLabel>
            )}

            {!loading && hasUsers && (
              <ChartLabel top="140px">
                <SidebarSection.Title>
                  {t('Users Adopted')}
                  <TooltipWrapper>
                    <QuestionTooltip
                      position="top"
                      title={t(
                        'Adoption compares the users of a release with the total users for this project.'
                      )}
                      size="sm"
                    />
                  </TooltipWrapper>
                </SidebarSection.Title>
              </ChartLabel>
            )}

            {errored ? (
              <ErrorPanel height="280px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            ) : (
              <TransitionChart loading={loading} reloading={reloading} height="280px">
                <TransparentLoadingMask visible={reloading} />
                <ChartZoom
                  period={period ?? undefined}
                  utc={utc === 'true'}
                  start={start}
                  end={end}
                  usePageDate
                  xAxisIndex={[sessionsAxisIndex, usersAxisIndex]}
                >
                  {zoomRenderProps => (
                    <LineChart
                      {...chartOptions}
                      {...zoomRenderProps}
                      series={getSeries()}
                      transformSinglePointToLine
                    />
                  )}
                </ChartZoom>
              </TransitionChart>
            )}
          </ErrorBoundary>
        </RelativeBox>
      </SidebarSection.Wrap>
    </div>
  );
}

const NotAvailableWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const ChartLabel = styled('div')<{top: string}>`
  position: absolute;
  top: ${p => p.top};
  z-index: 1;
  left: 0;
  right: 0;
`;

const TooltipWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

const AdoptionEnvironment = styled('span')`
  color: ${p => p.theme.textColor};
  margin-left: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const RelativeBox = styled('div')`
  position: relative;
`;

export default ReleaseAdoption;
