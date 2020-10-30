import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Release, ReleaseProject} from 'app/types';
import {PanelBody} from 'app/components/panels';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {defined} from 'app/utils';
import theme from 'app/utils/theme';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import TextOverflow from 'app/components/textOverflow';
import Placeholder from 'app/components/placeholder';
import Link from 'app/components/links/link';
import overflowEllipsis from 'app/styles/overflowEllipsis';

import HealthStatsChart from '../healthStatsChart';
import {convertAdoptionToProgress, getReleaseNewIssuesUrl} from '../../utils';
import HealthStatsSubject, {StatsSubject} from '../healthStatsSubject';
import HealthStatsPeriod, {StatsPeriod} from '../healthStatsPeriod';
import AdoptionTooltip from '../adoptionTooltip';
import NotAvailable from '../notAvailable';
import ClippedHealthRows from '../clippedHealthRows';
import CrashFree from '../crashFree';
import Header from './header';
import Item from './item';
import ProjectName from './projectName';

type Props = {
  projects: Array<ReleaseProject>;
  releaseVersion: Release['version'];
  orgSlug: string;
  location: Location;
  showPlaceholders: boolean;
};

const Content = ({
  projects,
  releaseVersion,
  location,
  orgSlug,
  showPlaceholders,
}: Props) => {
  const activeStatsPeriod = (location.query.healthStatsPeriod || '24h') as StatsPeriod;
  const activeStatsSubject = (location.query.healthStat || 'sessions') as StatsSubject;

  return (
    <React.Fragment>
      <Header>
        <HeaderLayout>
          <ProjectColumn>{t('Project name')}</ProjectColumn>
          <AdoptionColumn>{t('Release adoption')}</AdoptionColumn>
          <CrashFreeUsersColumn>{t('Crash free users')}</CrashFreeUsersColumn>
          <CrashFreeSessionsColumn>{t('Crash free sessions')}</CrashFreeSessionsColumn>
          <DailyUsersColumn>
            <HealthStatsSubject location={location} activeSubject={activeStatsSubject} />
            <HealthStatsPeriod location={location} activePeriod={activeStatsPeriod} />
          </DailyUsersColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <NewIssuesColumn>{t('New Issues')}</NewIssuesColumn>
        </HeaderLayout>
      </Header>

      <PanelBody>
        <StyledClippedHealthRows>
          {projects.map(project => {
            const {slug, healthData, newGroups} = project;
            const {
              hasHealthData,
              adoption,
              stats,
              crashFreeUsers,
              crashFreeSessions,
              sessionsCrashed,
              totalUsers,
              totalUsers24h,
              totalSessions,
              totalSessions24h,
            } = healthData || {};

            return (
              <Item key={`${releaseVersion}-${slug}-health`}>
                <Layout>
                  <ProjectColumn>
                    <ProjectName
                      orgSlug={orgSlug}
                      project={project}
                      releaseVersion={releaseVersion}
                    />
                  </ProjectColumn>

                  <AdoptionColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="150px" />
                    ) : defined(adoption) ? (
                      <AdoptionWrapper>
                        <Tooltip
                          title={
                            <AdoptionTooltip
                              totalUsers={totalUsers!}
                              totalSessions={totalSessions!}
                              totalUsers24h={totalUsers24h!}
                              totalSessions24h={totalSessions24h!}
                            />
                          }
                        >
                          <StyledScoreBar
                            score={convertAdoptionToProgress(adoption)}
                            size={20}
                            thickness={5}
                            radius={0}
                            palette={Array(10).fill(theme.purple500)}
                          />
                        </Tooltip>
                        <TextOverflow>
                          <Count value={totalUsers24h ?? 0} />{' '}
                          {tn('user', 'users', totalUsers24h)}
                        </TextOverflow>
                      </AdoptionWrapper>
                    ) : (
                      <NotAvailable />
                    )}
                  </AdoptionColumn>

                  <CrashFreeUsersColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="60px" />
                    ) : defined(crashFreeUsers) ? (
                      <CrashFree percent={crashFreeUsers} />
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashFreeUsersColumn>

                  <CrashFreeSessionsColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="60px" />
                    ) : defined(crashFreeSessions) ? (
                      <CrashFree percent={crashFreeSessions} />
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashFreeSessionsColumn>

                  <DailyUsersColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder />
                    ) : hasHealthData && defined(stats) ? (
                      <ChartWrapper>
                        <HealthStatsChart
                          data={stats}
                          height={20}
                          period={activeStatsPeriod}
                          subject={activeStatsSubject}
                        />
                      </ChartWrapper>
                    ) : (
                      <NotAvailable />
                    )}
                  </DailyUsersColumn>

                  <CrashesColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="30px" />
                    ) : hasHealthData && defined(sessionsCrashed) ? (
                      <Count value={sessionsCrashed} />
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashesColumn>

                  <NewIssuesColumn>
                    <Tooltip title={t('Open in Issues')}>
                      <Link
                        to={getReleaseNewIssuesUrl(orgSlug, project.id, releaseVersion)}
                      >
                        <Count value={newGroups || 0} />
                      </Link>
                    </Tooltip>
                  </NewIssuesColumn>
                </Layout>
              </Item>
            );
          })}
        </StyledClippedHealthRows>
      </PanelBody>
    </React.Fragment>
  );
};

export default Content;

const StyledClippedHealthRows = styled(ClippedHealthRows)`
  margin-bottom: -1px;
`;

const Layout = styled('div')`
  display: grid;
  grid-template-areas: 'project adoption crash-free-users crash-free-sessions daily-users crashes new-issues';
  grid-template-columns: 2fr 2fr 1.4fr 1.4fr 2.1fr 0.7fr 0.8fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-areas: 'project adoption crash-free-users crash-free-sessions crashes new-issues';
    grid-template-columns: 2fr 2fr 1.5fr 1.5fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-areas: 'project crash-free-users crash-free-sessions crashes new-issues';
    grid-template-columns: 2fr 1.5fr 1.5fr 1fr 1fr;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-areas: 'project crash-free-sessions new-issues';
    grid-template-columns: 2fr 1.6fr 1fr;
  }
`;

const HeaderLayout = styled(Layout)`
  align-items: flex-end;
`;

const Column = styled('div')`
  ${overflowEllipsis};
`;

const RightColumn = styled(Column)`
  text-align: right;
`;

const CenterColumn = styled(Column)`
  text-align: center;
`;

const ProjectColumn = styled(Column)`
  grid-area: project;
`;

const DailyUsersColumn = styled(Column)`
  grid-area: daily-users;
  display: flex;
  align-items: flex-end;
  /* Chart tooltips need overflow */
  overflow: visible;
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
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    text-align: left;
  }
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
const CrashFreeSessionsColumn = styled(CenterColumn)`
  grid-area: crash-free-sessions;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    text-align: left;
  }
`;
const CrashesColumn = styled(RightColumn)`
  grid-area: crashes;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;
const NewIssuesColumn = styled(RightColumn)`
  grid-area: new-issues;
`;

const AdoptionWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
`;

const StyledScoreBar = styled(ScoreBar)`
  margin-right: ${space(1)};
`;

const ChartWrapper = styled('div')`
  flex: 1;
  g > .barchart-rect {
    background: ${p => p.theme.gray400};
    fill: ${p => p.theme.gray400};
  }
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 20px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;
