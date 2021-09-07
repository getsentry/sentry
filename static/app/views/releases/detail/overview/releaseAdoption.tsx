import {withRouter, WithRouterProps} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import NotAvailable from 'app/components/notAvailable';
import QuestionTooltip from 'app/components/questionTooltip';
import SidebarSectionTitle from 'app/components/sidebarSectionTitle';
import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionField,
} from 'app/types';
import {getAdoptionSeries, getCount} from 'app/utils/sessions';
import {Theme} from 'app/utils/theme';
import {ADOPTION_STAGE_LABELS} from 'app/views/releases/list/releaseHealth/content';

import {getReleaseBounds, getReleaseParams} from '../../utils';
import {generateReleaseMarkLines, releaseMarkLinesLabels} from '../utils';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  release: ReleaseWithHealth;
  project: ReleaseProject;
  environment: string[];
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  theme: Theme;
} & WithRouterProps;

function ReleaseComparisonChart({
  release,
  project,
  environment,
  releaseSessions,
  allSessions,
  loading,
  reloading,
  errored,
  theme,
  router,
  location,
}: Props) {
  const hasUsers = !!getCount(releaseSessions?.groups, SessionField.USERS);

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
        axisIndex: 0,
      }
    );

    const series = [
      ...sessionsMarkLines,
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
      const usersMarkLines = generateReleaseMarkLines(release, project, theme, location, {
        hideLabel: true,
        axisIndex: 1,
      });

      series.push(...usersMarkLines);
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
      valueFormatter: (value: number, label?: string) =>
        label && Object.values(releaseMarkLinesLabels).includes(label) ? '' : `${value}%`,
      filter: (_, seriesParam) => {
        const {seriesName, axisIndex} = seriesParam;
        // do not display tooltips for "Users Adopted" marklines
        if (
          axisIndex === 1 &&
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
    defaultStatsPeriod: DEFAULT_STATS_PERIOD, // this will be removed once we get rid off legacy release details
    allowEmptyPeriod: true,
  });

  const adoptionStage = release.adoptionStages?.[project.slug].stage;
  const adoptionStageLabel = ADOPTION_STAGE_LABELS[adoptionStage];
  const allEnvironments = environment.length === 0;
  const multipleEnvironments = environment.length > 1;

  return (
    <Wrapper>
      <Feature features={['release-adoption-stage']}>
        <SectionHeading>
          {allEnvironments
            ? t('All Environments')
            : multipleEnvironments
            ? t(`${environment.join(', ')}`)
            : t(`${environment}`)}
        </SectionHeading>
        <SidebarSectionTitle title={t('Adoption Stage')}>
          {adoptionStageLabel && !allEnvironments && !multipleEnvironments ? (
            <Tooltip title={adoptionStageLabel.tooltipTitle}>
              <Tag type={adoptionStageLabel.type}>{adoptionStageLabel.name}</Tag>
            </Tooltip>
          ) : (
            <NotAvailable />
          )}
        </SidebarSectionTitle>
      </Feature>
      <RelativeBox>
        <ChartLabel top="0px">
          <ChartTitle
            title={t('Sessions Adopted')}
            icon={
              <QuestionTooltip
                position="top"
                title={t(
                  'Adoption compares the sessions of a release with the total sessions for this project.'
                )}
                size="sm"
              />
            }
          />
        </ChartLabel>

        {hasUsers && (
          <ChartLabel top="140px">
            <ChartTitle
              title={t('Users Adopted')}
              icon={
                <QuestionTooltip
                  position="top"
                  title={t(
                    'Adoption compares the users of a release with the total users for this project.'
                  )}
                  size="sm"
                />
              }
            />
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
              router={router}
              period={period ?? undefined}
              utc={utc === 'true'}
              start={start}
              end={end}
              usePageDate
              xAxisIndex={[0, 1]}
            >
              {zoomRenderProps => (
                <LineChart {...chartOptions} {...zoomRenderProps} series={getSeries()} />
              )}
            </ChartZoom>
          </TransitionChart>
        )}
      </RelativeBox>
    </Wrapper>
  );
}

const RelativeBox = styled('div')`
  position: relative;
`;

const ChartTitle = styled(SidebarSectionTitle)`
  margin: 0;
`;

const ChartLabel = styled('div')<{top: string}>`
  position: absolute;
  top: ${p => p.top};
  z-index: 1;
  left: 0;
  right: 0;
`;

export default withTheme(withRouter(ReleaseComparisonChart));
