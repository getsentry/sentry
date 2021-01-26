import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import ProgressBar from 'app/components/progressBar';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Release, ReleaseProject} from 'app/types';
import {defined} from 'app/utils';

import {getReleaseNewIssuesUrl, getReleaseUnhandledIssuesUrl} from '../../utils';
import AdoptionTooltip from '../adoptionTooltip';
import CrashFree from '../crashFree';
import HealthStatsChart from '../healthStatsChart';
import HealthStatsPeriod, {StatsPeriod} from '../healthStatsPeriod';
import NotAvailable from '../notAvailable';
import {DisplayOption} from '../utils';

import Header from './header';
import ProjectLink from './projectLink';

type Props = {
  projects: Array<ReleaseProject>;
  releaseVersion: Release['version'];
  orgSlug: string;
  activeDisplay: DisplayOption;
  location: Location;
  showPlaceholders: boolean;
};

const Content = ({
  projects,
  releaseVersion,
  location,
  orgSlug,
  activeDisplay,
  showPlaceholders,
}: Props) => {
  const activeStatsPeriod = (location.query.healthStatsPeriod || '24h') as StatsPeriod;
  const healthStatsPeriod = (
    <HealthStatsPeriod location={location} activePeriod={activeStatsPeriod} />
  );

  return (
    <React.Fragment>
      <Header>
        <Layout>
          <Column>{t('Project Name')}</Column>
          <AdoptionColumn>{t('User Adoption')}</AdoptionColumn>
          {activeDisplay === DisplayOption.CRASH_FREE_USERS ? (
            <React.Fragment>
              <SessionsColumn>{t('Crash Free Users')}</SessionsColumn>
              <DailyColumn>
                <span>{t('Users')}</span>
                {healthStatsPeriod}
              </DailyColumn>
            </React.Fragment>
          ) : (
            <React.Fragment>
              <SessionsColumn>{t('Crash Free Sessions')}</SessionsColumn>
              <DailyColumn>
                <span>{t('Sessions')}</span>
                {healthStatsPeriod}
              </DailyColumn>
            </React.Fragment>
          )}
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <NewIssuesColumn>{t('New Issues')}</NewIssuesColumn>
          <ViewColumn />
        </Layout>
      </Header>

      <ProjectRows>
        <Collapsible
          expandButton={({onExpand, numberOfCollapsedItems}) => (
            <ExpandButtonWrapper>
              <Button priority="primary" size="xsmall" onClick={onExpand}>
                {tct('Show [numberOfCollapsedItems] More', {
                  numberOfCollapsedItems,
                })}
              </Button>
            </ExpandButtonWrapper>
          )}
          collapseButton={({onCollapse}) => (
            <CollapseButtonWrapper>
              <Button priority="primary" size="xsmall" onClick={onCollapse}>
                {t('Collapse')}
              </Button>
            </CollapseButtonWrapper>
          )}
        >
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
                  <Column>
                    <ProjectBadge project={project} avatarSize={16} />
                  </Column>

                  <AdoptionColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="150px" />
                    ) : defined(adoption) ? (
                      <AdoptionWrapper>
                        <ProgressBarWrapper>
                          <Tooltip
                            containerDisplayMode="block"
                            title={
                              <AdoptionTooltip
                                totalUsers={totalUsers}
                                totalSessions={totalSessions}
                                totalUsers24h={totalUsers24h}
                                totalSessions24h={totalSessions24h}
                              />
                            }
                          >
                            <ProgressBar value={Math.ceil(adoption)} />
                          </Tooltip>
                        </ProgressBarWrapper>
                        <Count value={totalUsers24h ?? 0} />
                      </AdoptionWrapper>
                    ) : (
                      <NotAvailable />
                    )}
                  </AdoptionColumn>

                  {activeDisplay === DisplayOption.CRASH_FREE_USERS ? (
                    <SessionsColumn>
                      {showPlaceholders ? (
                        <StyledPlaceholder width="60px" />
                      ) : defined(crashFreeUsers) ? (
                        <CrashFree percent={crashFreeUsers} />
                      ) : (
                        <NotAvailable />
                      )}
                    </SessionsColumn>
                  ) : (
                    <SessionsColumn>
                      {showPlaceholders ? (
                        <StyledPlaceholder width="60px" />
                      ) : defined(crashFreeSessions) ? (
                        <CrashFree percent={crashFreeSessions} />
                      ) : (
                        <NotAvailable />
                      )}
                    </SessionsColumn>
                  )}

                  <DailyColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder />
                    ) : hasHealthData && defined(stats) ? (
                      <ChartWrapper>
                        <HealthStatsChart
                          data={stats}
                          height={20}
                          period={activeStatsPeriod}
                          activeDisplay={activeDisplay}
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
                      <Tooltip title={t('Open in Issues')}>
                        <GlobalSelectionLink
                          to={getReleaseUnhandledIssuesUrl(
                            orgSlug,
                            project.id,
                            releaseVersion
                          )}
                        >
                          <Count value={sessionsCrashed} />
                        </GlobalSelectionLink>
                      </Tooltip>
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashesColumn>

                  <NewIssuesColumn>
                    <Tooltip title={t('Open in Issues')}>
                      <GlobalSelectionLink
                        to={getReleaseNewIssuesUrl(orgSlug, project.id, releaseVersion)}
                      >
                        <Count value={newGroups || 0} />
                      </GlobalSelectionLink>
                    </Tooltip>
                  </NewIssuesColumn>

                  <ViewColumn>
                    <ProjectLink
                      orgSlug={orgSlug}
                      project={project}
                      releaseVersion={releaseVersion}
                    />
                  </ViewColumn>
                </Layout>
              </ProjectRow>
            );
          })}
        </Collapsible>
      </ProjectRows>
    </React.Fragment>
  );
};

export default Content;

const ProjectRows = styled('div')`
  position: relative;
`;

const ExpandButtonWrapper = styled('div')`
  position: absolute;
  width: 100%;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: linear-gradient(
    180deg,
    hsla(0, 0%, 100%, 0.15) 0,
    ${p => p.theme.white}
  );
  background-repeat: repeat-x;
  border-bottom: ${space(1)} solid ${p => p.theme.white};
  border-top: ${space(1)} solid transparent;
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }
`;

const CollapseButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 41px;
`;

const ProjectRow = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.6fr 0.7fr;
  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr 0.8fr 1fr 0.5fr 0.5fr 0.6fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 1fr 0.8fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }
`;

const Column = styled('div')`
  ${overflowEllipsis};
  line-height: 20px;
`;

const NewIssuesColumn = styled(Column)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: right;
  }
`;

const AdoptionColumn = styled(Column)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }
`;

const AdoptionWrapper = styled('span')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  align-items: center;
`;

const SessionsColumn = styled(Column)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: center;
  }
`;

const DailyColumn = styled(Column)`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }
`;

const CrashesColumn = styled(Column)`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    text-align: right;
  }
`;

const ViewColumn = styled(Column)`
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

const ProgressBarWrapper = styled('div')`
  min-width: 70px;
  max-width: 90px;
`;
