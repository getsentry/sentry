import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Count from 'app/components/count';
import Link from 'app/components/links/link';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Release, ReleaseProject} from 'app/types';
import {defined} from 'app/utils';
import theme from 'app/utils/theme';

import {convertAdoptionToProgress, getReleaseNewIssuesUrl} from '../../utils';
import AdoptionTooltip from '../adoptionTooltip';
import ClippedHealthRows from '../clippedHealthRows';
import CrashFree from '../crashFree';
import HealthStatsChart from '../healthStatsChart';
import HealthStatsPeriod, {StatsPeriod} from '../healthStatsPeriod';
import HealthStatsSubject, {StatsSubject} from '../healthStatsSubject';
import NotAvailable from '../notAvailable';

import Header from './header';
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
        <Layout>
          <ProjectColumn>{t('Project name')}</ProjectColumn>
          <AdoptionColumn>{t('User Adoption')}</AdoptionColumn>
          <UsersColumn>{t('Crash-free users')}</UsersColumn>
          <SessionsColumn>{t('Crash-free sessions')}</SessionsColumn>
          <DailyColumn>
            <HealthStatsSubject location={location} activeSubject={activeStatsSubject} />
            <HealthStatsPeriod location={location} activePeriod={activeStatsPeriod} />
          </DailyColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <IssuesColumn>{t('New Issues')}</IssuesColumn>
        </Layout>
      </Header>

      <ClippedHealthRows>
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
            <ProjectRow key={`${releaseVersion}-${slug}-health`}>
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
                    <AdoptionProgress>
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
                        <ScoreBar
                          score={convertAdoptionToProgress(adoption)}
                          size={20}
                          thickness={5}
                          radius={0}
                          palette={Array(10).fill(theme.purple300)}
                        />
                      </Tooltip>
                      <Count value={totalUsers24h ?? 0} />
                    </AdoptionProgress>
                  ) : (
                    <NotAvailable />
                  )}
                </AdoptionColumn>

                <UsersColumn>
                  {showPlaceholders ? (
                    <StyledPlaceholder width="60px" />
                  ) : defined(crashFreeUsers) ? (
                    <CrashFree percent={crashFreeUsers} />
                  ) : (
                    <NotAvailable />
                  )}
                </UsersColumn>

                <SessionsColumn>
                  {showPlaceholders ? (
                    <StyledPlaceholder width="60px" />
                  ) : defined(crashFreeSessions) ? (
                    <CrashFree percent={crashFreeSessions} />
                  ) : (
                    <NotAvailable />
                  )}
                </SessionsColumn>

                <DailyColumn>
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
                </DailyColumn>

                <CrashesColumn>
                  {showPlaceholders ? (
                    <StyledPlaceholder width="30px" />
                  ) : hasHealthData && defined(sessionsCrashed) ? (
                    <Count value={sessionsCrashed} />
                  ) : (
                    <NotAvailable />
                  )}
                </CrashesColumn>

                <IssuesColumn>
                  <Tooltip title={t('Open in Issues')}>
                    <Link
                      to={getReleaseNewIssuesUrl(orgSlug, project.id, releaseVersion)}
                    >
                      <Count value={newGroups || 0} />
                    </Link>
                  </Tooltip>
                </IssuesColumn>
              </Layout>
            </ProjectRow>
          );
        })}
      </ClippedHealthRows>
    </React.Fragment>
  );
};

export default Content;

const ProjectRow = styled(PanelItem)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    font-size: ${p => p.theme.fontSizeMedium};
    max-height: 41px;
  }
`;

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr 0.5fr 0.5fr;
  grid-column-gap: ${space(1)};
  align-content: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: 1fr 1fr 1fr 1fr 0.5fr 0.5fr;
  }
`;

const Column = styled('div')`
  ${overflowEllipsis};
`;

const ProjectColumn = styled(Column)``;

const AdoptionColumn = styled(Column)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }
`;

const AdoptionProgress = styled('span')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
`;

const UsersColumn = styled(Column)`
  display: none;
`;

const SessionsColumn = styled(Column)``;

const DailyColumn = styled(Column)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }
`;

const CrashesColumn = styled(Column)`
  text-align: right;
`;

const IssuesColumn = styled(Column)`
  text-align: right;
`;

const ChartWrapper = styled('div')`
  flex: 1;
  g > .barchart-rect {
    background: ${p => p.theme.gray200};
    fill: ${p => p.theme.gray200};
  }
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 20px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;
