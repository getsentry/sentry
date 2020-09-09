import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import partition from 'lodash/partition';
import flatten from 'lodash/flatten';

import {Release, GlobalSelection} from 'app/types';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import {PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import Count from 'app/components/count';
import {defined} from 'app/utils';
import theme from 'app/utils/theme';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import TextOverflow from 'app/components/textOverflow';
import Placeholder from 'app/components/placeholder';
import Link from 'app/components/links/link';

import HealthStatsChart from './healthStatsChart';
import {convertAdoptionToProgress, getReleaseNewIssuesUrl} from '../utils';
import HealthStatsSubject, {StatsSubject} from './healthStatsSubject';
import HealthStatsPeriod, {StatsPeriod} from './healthStatsPeriod';
import AdoptionTooltip from './adoptionTooltip';
import NotAvailable from './notAvailable';
import ClippedHealthRows from './clippedHealthRows';
import CrashFree from './crashFree';

type Props = {
  release: Release;
  orgSlug: string;
  location: Location;
  showPlaceholders: boolean;
  selection: GlobalSelection;
};

const ReleaseHealth = ({
  release,
  orgSlug,
  location,
  selection,
  showPlaceholders,
}: Props) => {
  const activeStatsPeriod = (location.query.healthStatsPeriod || '24h') as StatsPeriod;
  const activeStatsSubject = (location.query.healthStat || 'sessions') as StatsSubject;

  // sort health rows inside release card alphabetically by project name,
  // but put the ones with project selected in global header to top
  const sortedProjects = flatten(
    partition(
      release.projects.sort((a, b) => a.slug.localeCompare(b.slug)),
      p => selection.projects.includes(p.id)
    )
  );

  return (
    <React.Fragment>
      <StyledPanelHeader>
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
      </StyledPanelHeader>

      <PanelBody>
        <ClippedHealthRows fadeHeight="46px" maxVisibleItems={4}>
          {sortedProjects.map((project, index) => {
            const {id, slug, healthData, newGroups} = project;
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
              <StyledPanelItem
                key={`${release.version}-${slug}-health`}
                isLast={index === sortedProjects.length - 1}
              >
                <Layout>
                  <ProjectColumn>
                    <GlobalSelectionLink
                      to={{
                        pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
                          release.version
                        )}/`,
                        query: {project: id},
                      }}
                    >
                      <ProjectBadge project={project} avatarSize={16} />
                    </GlobalSelectionLink>
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
                        to={getReleaseNewIssuesUrl(orgSlug, project.id, release.version)}
                      >
                        <Count value={newGroups || 0} />
                      </Link>
                    </Tooltip>
                  </NewIssuesColumn>
                </Layout>
              </StyledPanelItem>
            );
          })}
        </ClippedHealthRows>
      </PanelBody>
    </React.Fragment>
  );
};

const StyledPanelHeader = styled(PanelHeader)`
  border-top: 1px solid ${p => p.theme.borderDark};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledPanelItem = styled(PanelItem)<{isLast: boolean}>`
  padding: ${space(1)} ${space(2)};
  min-height: 46px;
  border: ${p => (p.isLast ? 'none' : null)};
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
    grid-template-columns: 2fr 1.5fr 1fr;
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

const ProjectColumn = styled(Column)`
  grid-area: project;
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

export default ReleaseHealth;
