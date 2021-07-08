import {Fragment} from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import Count from 'app/components/count';
import Placeholder from 'app/components/placeholder';
import QuestionTooltip from 'app/components/questionTooltip';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {SessionApiResponse, SessionField} from 'app/types';
import {percent} from 'app/utils';
import {getAdoptionSeries, getCount} from 'app/utils/sessions';
import {Theme} from 'app/utils/theme';

import {SectionHeading} from './styles';

type Props = {
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  theme: Theme;
};

function ReleaseComparisonChart({
  releaseSessions,
  allSessions,
  loading,
  reloading,
  errored,
  theme,
}: Props) {
  const hasUsers = !!getCount(releaseSessions?.groups, SessionField.USERS);

  function getSeries() {
    if (!releaseSessions) {
      return [];
    }

    const series = [
      {
        seriesName: t('Sessions Adopted'),
        connectNulls: true,
        yAxisIndex: 0,
        xAxisIndex: 0,
        data: getAdoptionSeries(
          releaseSessions.groups,
          allSessions?.groups,
          releaseSessions.intervals,
          SessionField.SESSIONS
        ),
      },
    ];

    if (hasUsers) {
      series.push({
        seriesName: t('Users Adopted'),
        connectNulls: true,
        yAxisIndex: 1,
        xAxisIndex: 1,
        data: getAdoptionSeries(
          releaseSessions.groups,
          allSessions?.groups,
          releaseSessions.intervals,
          SessionField.USERS
        ),
      });
    }

    return series;
  }

  function getSummary(field: SessionField) {
    const allSessionsCount = getCount(allSessions?.groups, field);
    const releaseSessionsCount = getCount(releaseSessions?.groups, field);

    const adoptionPercent = Math.round(percent(releaseSessionsCount, allSessionsCount));

    return {adoptionPercent, allSessionsCount, releaseSessionsCount};
  }

  const colors = theme.charts.getColorPalette(2);

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

  const chartOptions = {
    height: hasUsers ? 320 : 160,
    grid: [
      {
        top: '60px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
      {
        top: '220px',
        left: '10px',
        right: '10px',
        height: '100px',
      },
    ],
    axisPointer: {
      // Link each x-axis together.
      link: [{xAxisIndex: [0, 1]}],
    },
    xAxes: Array.from(new Array(2)).map((_i, index) => ({
      gridIndex: index,
      type: 'time' as const,
      show: false,
    })),
    yAxes: [
      {
        // sessions adopted
        gridIndex: 0,
        ...axisLineConfig,
      },
      {
        // users adopted
        gridIndex: 1,
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
      valueFormatter: (value: number) => `${value}%`,
    },
  };

  const sessionsSummary = getSummary(SessionField.SESSIONS);
  const usersSummary = getSummary(SessionField.USERS);

  return (
    <RelativeBox>
      <ChartLabel top="0px">
        <ChartTitle>
          {t('Sessions Adopted')}
          <QuestionTooltip
            position="top"
            title={t(
              'Adoption compares the sessions of a release with the total sessions for this project.'
            )}
            size="sm"
          />
        </ChartTitle>
        <ChartSummaryValue
          isLoading={loading}
          error={errored}
          value={
            <Fragment>
              {`${sessionsSummary.adoptionPercent}%`}
              <ChartTotal>
                <Count value={sessionsSummary.releaseSessionsCount} />/
                <Count value={sessionsSummary.allSessionsCount} />
              </ChartTotal>
            </Fragment>
          }
        />
      </ChartLabel>

      {hasUsers && (
        <ChartLabel top="160px">
          <ChartTitle>
            {t('Users Adopted')}
            <QuestionTooltip
              position="top"
              title={t(
                'Adoption compares the users of a release with the total users for this project.'
              )}
              size="sm"
            />
          </ChartTitle>

          <ChartSummaryValue
            isLoading={loading}
            error={errored}
            value={
              <Fragment>
                {`${usersSummary.adoptionPercent}%`}
                <ChartTotal>
                  <Count value={usersSummary.releaseSessionsCount} />/
                  <Count value={usersSummary.allSessionsCount} />
                </ChartTotal>
              </Fragment>
            }
          />
        </ChartLabel>
      )}

      {errored ? (
        <ErrorPanel height="320px">
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      ) : (
        <TransitionChart loading={loading} reloading={reloading} height="320px">
          <TransparentLoadingMask visible={reloading} />
          <LineChart {...chartOptions} series={getSeries()} />
        </TransitionChart>
      )}
    </RelativeBox>
  );
}

const RelativeBox = styled('div')`
  position: relative;
`;

const ChartTitle = styled(SectionHeading)`
  margin: 0;
`;

const ChartLabel = styled('div')<{top: string}>`
  position: absolute;
  top: ${p => p.top};
  z-index: 1;
  left: 0;
  right: 0;
`;

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const ChartTotal = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

type ChartValueProps = {
  isLoading: boolean;
  error: string | null | boolean;
  value: React.ReactNode;
};

function ChartSummaryValue({error, isLoading, value}: ChartValueProps) {
  if (error) {
    return <div>{'\u2014'}</div>;
  } else if (isLoading) {
    return <Placeholder height="24px" />;
  } else {
    return <ChartValue>{value}</ChartValue>;
  }
}

export default withTheme(ReleaseComparisonChart);
