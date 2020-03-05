import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Link from 'app/components/links/link';
import {ProjectRelease} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {t} from 'app/locale';
import space from 'app/styles/space';
import CircleProgress from 'app/components/circularProgressbar';
import Count from 'app/components/count';
import {defined} from 'app/utils';
import ProgressBar, {StyledSlider, StyledBar} from 'app/views/releases/list/progressBar'; // TODO(releasesV2): wip

import UsersChart from './usersChart';
import {mockData} from './mock';
import {displayCrashFreePercent} from '../utils';

type Props = {
  release: ProjectRelease;
  location: Location;
};

const ReleaseHealth = ({release, location}: Props) => {
  const {pathname, query} = location;
  const activeHealthStatsPeriod = query.healthStatsPeriod || '24h';
  const {
    adoption,
    crashFreeUsers,
    crashFreeSessions,
    sessionsCrashed,
    sessionsErrored,
  } = release.healthData!;
  const healthStatsPeriods = [
    {
      key: '24h',
      label: t('24h'),
    },
    {
      key: '14d',
      label: t('14d'),
    },
  ];

  // TODO(releasesv2): make dynamic once api is finished
  return (
    <React.Fragment>
      <StyledPanelHeader>
        <HeaderLayout>
          <DailyUsersColumn>
            {t('Daily Active users')}:
            <StatsPeriodChanger>
              {healthStatsPeriods.map(healthStatsPeriod => (
                <StatsPeriod
                  key={healthStatsPeriod.key}
                  to={{
                    pathname,
                    query: {...query, healthStatsPeriod: healthStatsPeriod.key},
                  }}
                  active={activeHealthStatsPeriod === healthStatsPeriod.key}
                >
                  {healthStatsPeriod.label}
                </StatsPeriod>
              ))}
            </StatsPeriodChanger>
          </DailyUsersColumn>
          <AdoptionColumn>{t('Release adoption')}</AdoptionColumn>
          <CrashFreeUsersColumn>{t('Crash free users')}</CrashFreeUsersColumn>
          <CrashFreeSessionsColumn>{t('Crash free sessions')}</CrashFreeSessionsColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <ErrorsColumn>{t('Errors')}</ErrorsColumn>
        </HeaderLayout>
      </StyledPanelHeader>

      <PanelBody>
        <StyledPanelItem>
          <Layout>
            <DailyUsersColumn>
              <ChartWrapper>
                <UsersChart data={mockData[0].graphData} height={20} statsPeriod="24h" />
              </ChartWrapper>
            </DailyUsersColumn>

            <AdoptionColumn>
              {defined(adoption) ? <ProgressBar width={adoption} /> : '-'}
            </AdoptionColumn>

            <CrashFreeUsersColumn>
              {defined(crashFreeUsers) ? (
                <React.Fragment>
                  <CircleProgress value={crashFreeUsers} />
                  <CircleProgressCaption>
                    {displayCrashFreePercent(crashFreeUsers)}
                  </CircleProgressCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeUsersColumn>

            <CrashFreeSessionsColumn>
              {defined(crashFreeSessions) ? (
                <React.Fragment>
                  <CircleProgress value={crashFreeSessions} />
                  <CircleProgressCaption>
                    {displayCrashFreePercent(crashFreeSessions)}
                  </CircleProgressCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeSessionsColumn>

            <CrashesColumn>
              <Count value={sessionsCrashed ?? 0} />
            </CrashesColumn>

            <ErrorsColumn>
              <Count value={sessionsErrored ?? 0} />
            </ErrorsColumn>
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
  grid-template-areas: 'daily-users adoption crash-free-users crash-free-sessions crashes errors';
  grid-template-columns: 3fr minmax(230px, 2fr) 2fr 2fr 160px 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'adoption crash-free-users crash-free-sessions crashes errors';
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-areas: 'crash-free-users crash-free-sessions errors';
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
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;
const AdoptionColumn = styled(Column)`
  grid-area: adoption;
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }

  ${StyledBar} {
    background: ${p => p.theme.offWhite2};
    margin-bottom: 0;
    height: 8px;
  }

  ${StyledSlider} {
    background: ${p => p.theme.green};
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
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    display: none;
  }
`;
const ErrorsColumn = styled(RightColumn)`
  grid-area: errors;
`;

const StyledPanelItem = styled(PanelItem)`
  background: ${p => p.theme.offWhite};
  padding-top: 0;
`;

const CircleProgressCaption = styled('span')`
  margin-left: ${space(1)};
`;

const ChartWrapper = styled('div')`
  margin-right: ${space(2)};
  g > .barchart-rect {
    background: #c6becf;
    fill: #c6becf;
  }
`;

const StatsPeriodChanger = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  grid-column-gap: ${space(0.75)};
  flex: 1;
  justify-content: flex-end;
  text-align: right;
  margin-right: ${space(2)};
`;

const StatsPeriod = styled(Link)<{active: boolean}>`
  color: ${p => (p.active ? p.theme.gray3 : p.theme.gray2)};

  &:hover {
    color: ${p => (p.active ? p.theme.gray3 : p.theme.gray2)};
  }
`;

export default ReleaseHealth;
