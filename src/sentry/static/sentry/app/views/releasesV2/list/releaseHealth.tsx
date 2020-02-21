import React from 'react';
import styled from '@emotion/styled';

import {Release} from 'app/types';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {t} from 'app/locale';
import space from 'app/styles/space';
import CircleProgress from 'app/components/circularProgressbar';
import Count from 'app/components/count';

import UsersChart from './usersChart';
import {mockData} from './mock';

type Props = {
  release: Release;
};

const ReleaseHealth = ({release}: Props) => {
  return (
    <React.Fragment>
      <StyledPanelHeader>
        <HeaderLayout>
          <ProjectColumn>{t('Project')}</ProjectColumn>
          <CrashFreeUsersColumn>{t('Crash free users')}</CrashFreeUsersColumn>
          <CrashFreeSessionsColumn>{t('Crash free sessions')}</CrashFreeSessionsColumn>
          <DailyUsersColumn>{t('Daily active users')}</DailyUsersColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <ErrorsColumn>{t('Errors')}</ErrorsColumn>
        </HeaderLayout>
      </StyledPanelHeader>

      <PanelBody>
        {release.projects.map((project, index) => (
          <PanelItem key={project.slug}>
            <Layout>
              <ProjectColumn>
                <ProjectBadge project={project} avatarSize={14} />
              </ProjectColumn>
              {/* TODO(releasesv2): make dynamic once api is finished */}
              <CrashFreeUsersColumn>
                <CircleProgress value={mockData[index].crashFreeUsersPercent} />
                <CircleProgressCaption>
                  {mockData[index].crashFreeUsersPercent}%
                </CircleProgressCaption>
              </CrashFreeUsersColumn>
              <CrashFreeSessionsColumn>
                <CircleProgress value={mockData[index].crashFreeUsersSessionsPercent} />
                <CircleProgressCaption>
                  {mockData[index].crashFreeUsersSessionsPercent}%
                </CircleProgressCaption>
              </CrashFreeSessionsColumn>
              <DailyUsersColumn>
                <ChartWrapper>
                  <UsersChart data={mockData[index].graphData} statsPeriod="24h" />
                </ChartWrapper>
                {mockData[index].dailyActiveUsers}%
              </DailyUsersColumn>
              <CrashesColumn>
                <ColoredCount value={mockData[index].crashes} />
              </CrashesColumn>
              <ErrorsColumn>
                <ColoredCount value={mockData[index].errors} />
              </ErrorsColumn>
            </Layout>
          </PanelItem>
        ))}
      </PanelBody>
    </React.Fragment>
  );
};

const StyledPanelHeader = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.borderDark};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Layout = styled('div')`
  display: grid;
  grid-template-areas: 'project crash-free-users crash-free-sessions daily-users crashes errors';
  grid-template-columns: 1fr 1fr 1fr 200px 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'project crash-free-users crash-free-sessions crashes errors';
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-areas: 'project crash-free-users crash-free-sessions';
    grid-template-columns: 1fr 1fr 1fr;
  }
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
`;

const Column = styled('div')`
  overflow: hidden;
`;

const RightColumn = styled('div')`
  overflow: 'hidden';
  text-align: right;
`;

const ProjectColumn = styled(Column)`
  grid-area: project;
`;
const CrashFreeUsersColumn = styled(Column)`
  grid-area: crash-free-users;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    text-align: right;
  }
`;
const CrashFreeSessionsColumn = styled(Column)`
  grid-area: crash-free-sessions;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    text-align: right;
  }
`;
const DailyUsersColumn = styled(Column)`
  grid-area: daily-users;
  display: flex;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;
const CrashesColumn = styled(RightColumn)`
  grid-area: crashes;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
const ErrorsColumn = styled(RightColumn)`
  grid-area: errors;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const CircleProgressCaption = styled('span')`
  margin-left: ${space(1)};
`;

const ChartWrapper = styled('div')`
  width: 150px;
  margin-right: ${space(2)};
  position: relative;
  bottom: 4px;
`;

const ColoredCount = styled(Count)`
  /* TODO(releasesv2): decide on threshold, make dynamic */
  ${p => p.value > 7000 && `color: ${p.theme.red};`}
`;

export default ReleaseHealth;
