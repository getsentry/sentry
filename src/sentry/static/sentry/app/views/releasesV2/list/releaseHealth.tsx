import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {ProjectRelease} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import ProgressRing from 'app/components/progressRing';
import Count from 'app/components/count';
import {defined} from 'app/utils';
import theme from 'app/utils/theme';
import ScoreBar, {Bar} from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';

import HealthStatsChart from './healthStatsChart';
import {
  displayCrashFreePercent,
  convertAdoptionToProgress,
  getCrashFreePercentColor,
} from '../utils';
import HealthStatsSubject, {StatsSubject} from './healthStatsSubject';
import HealthStatsPeriod, {StatsPeriod} from './healthStatsPeriod';
import AdoptionTooltip from './adoptionTooltip';

type Props = {
  release: ProjectRelease;
  location: Location;
};

const ReleaseHealth = ({release, location}: Props) => {
  const activeStatsPeriod = (location.query.healthStatsPeriod || '24h') as StatsPeriod;
  const activeStatsSubject = (location.query.healthStat || 'sessions') as StatsSubject;

  const {
    adoption,
    stats,
    crashFreeUsers,
    crashFreeSessions,
    sessionsCrashed,
    totalUsers,
    totalUsers24h,
    totalSessions,
    totalSessions24h,
  } = release.healthData!;

  return (
    <React.Fragment>
      <StyledPanelHeader>
        <HeaderLayout>
          <DailyUsersColumn>
            <HealthStatsSubject location={location} activeSubject={activeStatsSubject} />
            <HealthStatsPeriod location={location} activePeriod={activeStatsPeriod} />
          </DailyUsersColumn>
          <AdoptionColumn>{t('Release adoption')}</AdoptionColumn>
          <CrashFreeUsersColumn>{t('Crash free users')}</CrashFreeUsersColumn>
          <CrashFreeSessionsColumn>{t('Crash free sessions')}</CrashFreeSessionsColumn>
          <ErrorsColumn>{/* {t('Errors')} */}</ErrorsColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
        </HeaderLayout>
      </StyledPanelHeader>

      <PanelBody>
        <StyledPanelItem>
          <Layout>
            <DailyUsersColumn>
              <ChartWrapper>
                <HealthStatsChart
                  data={stats}
                  height={20}
                  period={activeStatsPeriod}
                  subject={activeStatsSubject}
                />
              </ChartWrapper>
            </DailyUsersColumn>

            <AdoptionColumn>
              <AdoptionWrapper>
                <Tooltip
                  title={
                    <AdoptionTooltip
                      totalUsers={totalUsers}
                      totalSessions={totalSessions}
                      totalUsers24h={totalUsers24h}
                      totalSessions24h={totalSessions24h}
                    />
                  }
                >
                  <StyledScoreBar
                    score={convertAdoptionToProgress(adoption ?? 0)}
                    size={14}
                    thickness={14}
                    palette={[
                      theme.red,
                      theme.yellowOrange,
                      theme.yellowOrange,
                      theme.green,
                      theme.green,
                    ]}
                  />
                </Tooltip>
                <div>
                  <Count value={totalUsers24h ?? 0} />{' '}
                  {tn('user', 'users', totalUsers24h)}
                </div>
              </AdoptionWrapper>
            </AdoptionColumn>

            <CrashFreeUsersColumn>
              {defined(crashFreeUsers) ? (
                <React.Fragment>
                  <StyledProgressRing
                    progressColor={getCrashFreePercentColor}
                    value={crashFreeUsers}
                  />
                  <ProgressRingCaption>
                    {displayCrashFreePercent(crashFreeUsers)}
                  </ProgressRingCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeUsersColumn>

            <CrashFreeSessionsColumn>
              {defined(crashFreeSessions) ? (
                <React.Fragment>
                  <StyledProgressRing
                    progressColor={getCrashFreePercentColor}
                    value={crashFreeSessions}
                  />
                  <ProgressRingCaption>
                    {displayCrashFreePercent(crashFreeSessions)}
                  </ProgressRingCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeSessionsColumn>

            <ErrorsColumn>{/* <Count value={sessionsErrored ?? 0} /> */}</ErrorsColumn>

            <CrashesColumn>
              <Count value={sessionsCrashed ?? 0} />
            </CrashesColumn>
          </Layout>
        </StyledPanelItem>
      </PanelBody>
    </React.Fragment>
  );
};

const StyledPanelHeader = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.borderDark};
  border-bottom: none;
  padding-bottom: ${space(1)};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Layout = styled('div')`
  display: grid;
  grid-template-areas: 'daily-users adoption crash-free-users crash-free-sessions errors crashes';
  grid-template-columns: 3fr minmax(230px, 2fr) 2fr 2fr 160px 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'adoption crash-free-users crash-free-sessions errors crashes';
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-areas: 'crash-free-users crash-free-sessions crashes';
    grid-template-columns: 2fr 2fr 1fr;
  }
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
`;

const Column = styled('div')`
  overflow: hidden;
`;

const RightColumn = styled(Column)`
  text-align: right;
`;

const CenterColumn = styled(Column)`
  text-align: center;
`;

const DailyUsersColumn = styled(Column)`
  grid-area: daily-users;
  display: flex;
  align-items: flex-end;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;
const AdoptionColumn = styled(Column)`
  grid-area: adoption;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }

  ${Bar} {
    /* TODO(releasesV2): this is still wip */
    margin: 3px;
  }
`;
const CrashFreeUsersColumn = styled(CenterColumn)`
  grid-area: crash-free-users;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    text-align: left;
  }
`;
const CrashFreeSessionsColumn = styled(CenterColumn)`
  grid-area: crash-free-sessions;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    text-align: left;
  }
`;
const CrashesColumn = styled(RightColumn)`
  grid-area: crashes;
`;
const ErrorsColumn = styled(RightColumn)`
  grid-area: errors;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;

const StyledPanelItem = styled(PanelItem)`
  background: ${p => p.theme.offWhite};
  padding-top: 0;
`;

const AdoptionWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap-reverse;
`;

const StyledScoreBar = styled(ScoreBar)`
  margin-right: ${space(1)};
`;

const StyledProgressRing = styled(ProgressRing)`
  position: relative;
  top: ${space(0.5)};
`;

const ProgressRingCaption = styled('span')`
  margin-left: ${space(1)};
`;

const ChartWrapper = styled('div')`
  flex: 1;
  margin-right: ${space(2)};
  g > .barchart-rect {
    /* TODO(releasesV2): figure out with design these colors */
    background: #c6becf;
    fill: #c6becf;
  }
`;

export default ReleaseHealth;
