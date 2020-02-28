import React from 'react';
import styled from '@emotion/styled';

import {ProjectRelease} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import CircleProgress from 'app/components/circularProgressbar';
import Count from 'app/components/count';
import {defined} from 'app/utils';

import UsersChart from './usersChart';
import {mockData} from './mock';

type Props = {
  release: ProjectRelease;
};

const ReleaseHealth = ({release}: Props) => {
  const {
    adoption,
    total_users,
    crash_free_users,
    crash_free_sessions,
    crashes,
    errors,
  } = release.healthData!;

  // TODO(releasesv2): make dynamic once api is finished
  return (
    <React.Fragment>
      <StyledPanelHeader>
        <HeaderLayout>
          <DailyUsersColumn>{t('Daily active users')}</DailyUsersColumn>
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
              {defined(adoption) ? (
                <React.Fragment>
                  <CircleProgress value={adoption} />
                  <CircleProgressCaption>
                    {`${adoption}% ${tn('with %s user', 'with %s users', total_users)}`}
                  </CircleProgressCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </AdoptionColumn>

            <CrashFreeUsersColumn>
              {defined(crash_free_users) ? (
                <React.Fragment>
                  <CircleProgress value={crash_free_users} />
                  <CircleProgressCaption>{crash_free_users}%</CircleProgressCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeUsersColumn>

            <CrashFreeSessionsColumn>
              {defined(crash_free_sessions) ? (
                <React.Fragment>
                  <CircleProgress value={crash_free_sessions} />
                  <CircleProgressCaption>{crash_free_sessions}%</CircleProgressCaption>
                </React.Fragment>
              ) : (
                '-'
              )}
            </CrashFreeSessionsColumn>

            <CrashesColumn>
              <Count value={crashes ?? 0} />
            </CrashesColumn>

            <ErrorsColumn>
              <Count value={errors ?? 0} />
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
  grid-template-columns: 3fr minmax(230px, 2fr) 2fr 2fr 1fr 1fr;
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
    background: ${p => p.theme.gray2};
    fill: ${p => p.theme.gray2};
  }
`;

export default ReleaseHealth;
