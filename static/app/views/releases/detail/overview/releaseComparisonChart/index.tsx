import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';
import round from 'lodash/round';
import moment from 'moment';

import ErrorPanel from 'app/components/charts/errorPanel';
import {ChartContainer} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import Count from 'app/components/count';
import NotAvailable from 'app/components/notAvailable';
import {Panel, PanelTable} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Radio from 'app/components/radio';
import {PlatformKey} from 'app/data/platformCategories';
import {IconArrow, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {
  ReleaseComparisonChartType,
  ReleaseProject,
  ReleaseWithHealth,
  SessionApiResponse,
  SessionField,
} from 'app/types';
import {defined, percent} from 'app/utils';
import {decodeScalar} from 'app/utils/queryString';
import {getCount, getCrashFreeRate, getCrashFreeSeries} from 'app/utils/sessions';
import {Color, Theme} from 'app/utils/theme';
import {displayCrashFreePercent} from 'app/views/releases/utils';

import {generateReleaseMarkLine, releaseComparisonChartLabels} from '../../utils';
import {
  fillChartDataFromSessionsResponse,
  initSessionsBreakdownChartData,
} from '../chart/utils';

import SessionsChart from './sessionsChart';

type ComparisonRow = {
  type: ReleaseComparisonChartType;
  thisRelease: React.ReactNode;
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffDirection: 'up' | 'down' | null;
  diffColor: Color | null;
};

type Props = {
  release: ReleaseWithHealth;
  project: ReleaseProject;
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
  platform: PlatformKey;
  location: Location;
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  theme: Theme;
};

function ReleaseComparisonChart({
  release,
  project,
  releaseSessions,
  allSessions,
  platform,
  location,
  loading,
  reloading,
  errored,
  theme,
}: Props) {
  const activeChart = decodeScalar(
    location.query.chart,
    ReleaseComparisonChartType.CRASH_FREE_SESSIONS
  ) as ReleaseComparisonChartType;

  const releaseCrashFreeSessions = getCrashFreeRate(
    releaseSessions?.groups,
    SessionField.SESSIONS
  );
  const allCrashFreeSessions = getCrashFreeRate(
    allSessions?.groups,
    SessionField.SESSIONS
  );
  const diffCrashFreeSessions =
    defined(releaseCrashFreeSessions) && defined(allCrashFreeSessions)
      ? releaseCrashFreeSessions - allCrashFreeSessions
      : null;

  const releaseCrashFreeUsers = getCrashFreeRate(
    releaseSessions?.groups,
    SessionField.USERS
  );
  const allCrashFreeUsers = getCrashFreeRate(allSessions?.groups, SessionField.USERS);
  const diffCrashFreeUsers =
    defined(releaseCrashFreeUsers) && defined(allCrashFreeUsers)
      ? releaseCrashFreeUsers - allCrashFreeUsers
      : null;

  const releaseSessionsCount = getCount(releaseSessions?.groups, SessionField.SESSIONS);
  const allSessionsCount = getCount(allSessions?.groups, SessionField.SESSIONS);
  const diffSessionsCount =
    defined(releaseSessions) && defined(allSessions)
      ? percent(releaseSessionsCount - allSessionsCount, allSessionsCount)
      : null;

  const releaseUsersCount = getCount(releaseSessions?.groups, SessionField.USERS);
  const allUsersCount = getCount(allSessions?.groups, SessionField.USERS);
  const diffUsersCount =
    defined(releaseUsersCount) && defined(allUsersCount)
      ? percent(releaseUsersCount - allUsersCount, allUsersCount)
      : null;

  const charts: ComparisonRow[] = [
    {
      type: ReleaseComparisonChartType.CRASH_FREE_SESSIONS,
      thisRelease: defined(releaseCrashFreeSessions)
        ? displayCrashFreePercent(releaseCrashFreeSessions)
        : null,
      allReleases: defined(allCrashFreeSessions)
        ? displayCrashFreePercent(allCrashFreeSessions)
        : null,
      diff: defined(diffCrashFreeSessions)
        ? `${Math.abs(round(diffCrashFreeSessions, 3))}%`
        : null,
      diffDirection: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: diffCrashFreeSessions
        ? diffCrashFreeSessions > 0
          ? 'green300'
          : 'red300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.CRASH_FREE_USERS,
      thisRelease: defined(releaseCrashFreeUsers)
        ? displayCrashFreePercent(releaseCrashFreeUsers)
        : null,
      allReleases: defined(allCrashFreeUsers)
        ? displayCrashFreePercent(allCrashFreeUsers)
        : null,
      diff: defined(diffCrashFreeUsers)
        ? `${Math.abs(round(diffCrashFreeUsers, 3))}%`
        : null,
      diffDirection: diffCrashFreeUsers ? (diffCrashFreeUsers > 0 ? 'up' : 'down') : null,
      diffColor: diffCrashFreeUsers
        ? diffCrashFreeUsers > 0
          ? 'green300'
          : 'red300'
        : null,
    },
    {
      type: ReleaseComparisonChartType.SESSION_COUNT,
      thisRelease: defined(releaseSessionsCount) ? (
        <Count value={releaseSessionsCount} />
      ) : null,
      allReleases: defined(allSessionsCount) ? <Count value={allSessionsCount} /> : null,
      diff: defined(diffSessionsCount)
        ? `${Math.abs(round(diffSessionsCount, 0))}%`
        : null,
      diffDirection: defined(diffSessionsCount)
        ? diffSessionsCount > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: null,
    },
    {
      type: ReleaseComparisonChartType.USER_COUNT,
      thisRelease: defined(releaseUsersCount) ? (
        <Count value={releaseUsersCount} />
      ) : null,
      allReleases: defined(allUsersCount) ? <Count value={allUsersCount} /> : null,
      diff: defined(diffUsersCount) ? `${Math.abs(round(diffUsersCount, 0))}%` : null,
      diffDirection: defined(diffUsersCount)
        ? diffUsersCount > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: null,
    },
  ];

  function getSeries(chartType: ReleaseComparisonChartType) {
    if (!releaseSessions) {
      return {};
    }

    const adoptionStages = release.adoptionStages?.[project.slug];

    const markLines = [
      generateReleaseMarkLine(
        t('Release Created'),
        moment(release.dateCreated).valueOf(),
        theme
      ),
    ];

    if (adoptionStages?.adopted) {
      markLines.push(
        generateReleaseMarkLine(
          t('Adopted'),
          moment(adoptionStages.adopted).valueOf(),
          theme
        )
      );
    }

    if (adoptionStages?.unadopted) {
      markLines.push(
        generateReleaseMarkLine(
          t('Unadopted'),
          moment(adoptionStages.unadopted).valueOf(),
          theme
        )
      );
    }

    switch (chartType) {
      case ReleaseComparisonChartType.CRASH_FREE_SESSIONS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getCrashFreeSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.SESSIONS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.SESSIONS
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.CRASH_FREE_USERS:
        return {
          series: [
            {
              seriesName: t('This Release'),
              connectNulls: true,
              data: getCrashFreeSeries(
                releaseSessions?.groups,
                releaseSessions?.intervals,
                SessionField.USERS
              ),
            },
          ],
          previousSeries: [
            {
              seriesName: t('All Releases'),
              data: getCrashFreeSeries(
                allSessions?.groups,
                allSessions?.intervals,
                SessionField.USERS
              ),
            },
          ],
          markLines,
        };
      case ReleaseComparisonChartType.SESSION_COUNT:
        return {
          series: Object.values(
            fillChartDataFromSessionsResponse({
              response: releaseSessions,
              field: SessionField.SESSIONS,
              groupBy: 'session.status',
              chartData: initSessionsBreakdownChartData(),
            })
          ),
          markLines,
        };
      case ReleaseComparisonChartType.USER_COUNT:
        return {
          series: Object.values(
            fillChartDataFromSessionsResponse({
              response: releaseSessions,
              field: SessionField.USERS,
              groupBy: 'session.status',
              chartData: initSessionsBreakdownChartData(),
            })
          ),
          markLines,
        };
      default:
        return {};
    }
  }

  function handleChartChange(chartType: ReleaseComparisonChartType) {
    browserHistory.push({
      ...location,
      query: {
        ...location.query,
        chart: chartType,
      },
    });
  }

  const {series, previousSeries, markLines} = getSeries(activeChart);

  if (errored) {
    return (
      <Panel>
        <ErrorPanel>
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      </Panel>
    );
  }

  return (
    <Fragment>
      <ChartPanel>
        <ChartContainer>
          <TransitionChart loading={loading} reloading={reloading}>
            <TransparentLoadingMask visible={reloading} />

            <SessionsChart
              series={[...(series ?? []), ...(markLines ?? [])]}
              previousSeries={previousSeries ?? []}
              chartType={activeChart}
              platform={platform}
            />
          </TransitionChart>
        </ChartContainer>
      </ChartPanel>
      <ChartTable
        headers={[
          <Cell key="stability" align="left">
            {t('Stability')}
          </Cell>,
          <Cell key="releases" align="right">
            {t('All Releases')}
          </Cell>,
          <Cell key="release" align="right">
            {t('This Release')}
          </Cell>,
          <Cell key="change" align="right">
            {t('Change')}
          </Cell>,
        ]}
      >
        {charts.map(
          ({type, thisRelease, allReleases, diff, diffDirection, diffColor}) => {
            return (
              <Fragment key={type}>
                <Cell align="left">
                  <ChartToggle htmlFor={type}>
                    <Radio
                      id={type}
                      disabled={false}
                      checked={type === activeChart}
                      onChange={() => handleChartChange(type)}
                    />
                    {releaseComparisonChartLabels[type]}
                  </ChartToggle>
                </Cell>
                <Cell align="right">
                  {loading ? <Placeholder height="20px" /> : allReleases}
                </Cell>
                <Cell align="right">
                  {loading ? <Placeholder height="20px" /> : thisRelease}
                </Cell>
                <Cell align="right">
                  {loading ? (
                    <Placeholder height="20px" />
                  ) : defined(diff) ? (
                    <Change color={defined(diffColor) ? diffColor : undefined}>
                      {defined(diffDirection) && (
                        <IconArrow direction={diffDirection} size="xs" />
                      )}{' '}
                      {diff}
                    </Change>
                  ) : (
                    <NotAvailable />
                  )}
                </Cell>
              </Fragment>
            );
          }
        )}
      </ChartTable>
    </Fragment>
  );
}

const ChartPanel = styled(Panel)`
  margin-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom: none;
  border-bottom-right-radius: 0;
`;

const ChartTable = styled(PanelTable)`
  border-top-left-radius: 0;
  border-top-right-radius: 0;

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: min-content 1fr 1fr 1fr;
  }
`;

const Cell = styled('div')<{align: 'left' | 'right'}>`
  text-align: ${p => p.align};
  ${overflowEllipsis}
`;

const ChartToggle = styled('label')`
  display: flex;
  align-items: center;
  font-weight: 400;
  margin-bottom: 0;
  input {
    flex-shrink: 0;
    margin-right: ${space(1)} !important;
  }
`;

const Change = styled('div')<{color?: Color}>`
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;

export default withTheme(ReleaseComparisonChart);
