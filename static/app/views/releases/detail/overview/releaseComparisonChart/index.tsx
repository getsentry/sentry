import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import Count from 'app/components/count';
import NotAvailable from 'app/components/notAvailable';
import {PanelTable} from 'app/components/panels';
import Radio from 'app/components/radio';
import {IconArrow} from 'app/icons';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {SessionApiResponse, SessionField} from 'app/types';
import {defined} from 'app/utils';
import {getCount, getCrashFreeRate} from 'app/utils/sessions';
import {Color} from 'app/utils/theme';
import {displayCrashFreePercent} from 'app/views/releases/utils';

enum ReleaseComparisonChartType {
  CRASH_FREE_USERS = 'crashFreeUsers',
  CRASH_FREE_SESSIONS = 'crashFreeSessions',
  SESSION_COUNT = 'sessionCount',
  USER_COUNT = 'userCount',
}

const releaseComparisonChartLabels = {
  [ReleaseComparisonChartType.CRASH_FREE_USERS]: t('Crash Free Users'),
  [ReleaseComparisonChartType.CRASH_FREE_SESSIONS]: t('Crash Free Sessions'),
  [ReleaseComparisonChartType.SESSION_COUNT]: t('Session Count'),
  [ReleaseComparisonChartType.USER_COUNT]: t('User Count'),
};

type ComparisonRow = {
  type: ReleaseComparisonChartType;
  thisRelease: React.ReactNode;
  allReleases: React.ReactNode;
  diff: React.ReactNode;
  diffDirection: 'up' | 'down' | null;
  diffColor: Color | null;
};

type Props = {
  releaseSessions: SessionApiResponse | null;
  allSessions: SessionApiResponse | null;
};

function ReleaseComparisonChart({releaseSessions, allSessions}: Props) {
  const [activeChart, setActiveChart] = useState(
    ReleaseComparisonChartType.CRASH_FREE_SESSIONS
  );

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
      ? releaseSessionsCount - allSessionsCount
      : null;

  const releaseUsersCount = getCount(releaseSessions?.groups, SessionField.USERS);
  const allUsersCount = getCount(allSessions?.groups, SessionField.USERS);
  const diffUsersCount =
    defined(releaseUsersCount) && defined(allUsersCount)
      ? releaseUsersCount - allUsersCount
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
      diff: defined(diffSessionsCount) ? (
        <Count value={Math.abs(diffSessionsCount)} />
      ) : null,
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
      diff: defined(diffUsersCount) ? <Count value={Math.abs(diffUsersCount)} /> : null,
      diffDirection: defined(diffUsersCount)
        ? diffUsersCount > 0
          ? 'up'
          : 'down'
        : null,
      diffColor: null,
    },
  ];

  return (
    <StyledPanelTable
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
      {charts.map(({type, thisRelease, allReleases, diff, diffDirection, diffColor}) => {
        return (
          <Fragment key={type}>
            <Cell align="left">
              <ChartToggle htmlFor={type}>
                <Radio
                  id={type}
                  disabled={false}
                  checked={type === activeChart}
                  onChange={() => setActiveChart(type)}
                />
                {releaseComparisonChartLabels[type]}
              </ChartToggle>
            </Cell>
            <Cell align="right">{allReleases}</Cell>
            <Cell align="right">{thisRelease}</Cell>
            <Cell align="right">
              {defined(diff) ? (
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
      })}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
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

export default ReleaseComparisonChart;
