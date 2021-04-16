import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import NotAvailable from 'app/components/notAvailable';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import {t, tct} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Release, ReleaseProject} from 'app/types';
import {defined} from 'app/utils';

import {getReleaseNewIssuesUrl, getReleaseUnhandledIssuesUrl} from '../../utils';
import {ReleaseHealthRequestRenderProps} from '../../utils/releaseHealthRequest';
import CrashFree from '../crashFree';
import HealthStatsChart from '../healthStatsChart';
import HealthStatsPeriod from '../healthStatsPeriod';
import ReleaseAdoption from '../releaseAdoption';
import {DisplayOption} from '../utils';

import Header from './header';
import ProjectLink from './projectLink';

type Props = {
  projects: Array<ReleaseProject>;
  releaseVersion: Release['version'];
  organization: Organization;
  activeDisplay: DisplayOption;
  location: Location;
  showPlaceholders: boolean;
  isTopRelease: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
};

const Content = ({
  projects,
  releaseVersion,
  location,
  organization,
  activeDisplay,
  showPlaceholders,
  isTopRelease,
  getHealthData,
}: Props) => {
  return (
    <React.Fragment>
      <Header>
        <Layout>
          <Column>{t('Project Name')}</Column>
          <AdoptionColumn>
            <GuideAnchor
              target="release_adoption"
              position="bottom"
              disabled={!(isTopRelease && window.innerWidth >= 800)}
            >
              {t('Adoption')}
            </GuideAnchor>
          </AdoptionColumn>
          <CrashFreeRateColumn>{t('Crash Free Rate')}</CrashFreeRateColumn>
          <CountColumn>
            <span>{t('Count')}</span>
            <HealthStatsPeriod location={location} />
          </CountColumn>
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
          {projects.map((project, index) => {
            const {id, slug, newGroups} = project;

            const crashCount = getHealthData.getCrashCount(
              releaseVersion,
              id,
              DisplayOption.SESSIONS
            );
            const crashFreeRate = getHealthData.getCrashFreeRate(
              releaseVersion,
              id,
              activeDisplay
            );
            const get24hCountByRelease = getHealthData.get24hCountByRelease(
              releaseVersion,
              id,
              activeDisplay
            );
            const get24hCountByProject = getHealthData.get24hCountByProject(
              id,
              activeDisplay
            );
            const timeSeries = getHealthData.getTimeSeries(
              releaseVersion,
              id,
              activeDisplay
            );
            const adoption = getHealthData.getAdoption(releaseVersion, id, activeDisplay);
            // we currently don't support sub-hour session intervals, we rather hide the count histogram than to show only two bars
            const hasCountHistogram =
              timeSeries?.[0].data.length > 7 &&
              timeSeries[0].data.some(item => item.value > 0);

            return (
              <ProjectRow key={`${releaseVersion}-${slug}-health`}>
                <Layout>
                  <Column>
                    <ProjectBadge project={project} avatarSize={16} />
                  </Column>

                  <AdoptionColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="150px" />
                    ) : get24hCountByProject ? (
                      <AdoptionWrapper>
                        <ReleaseAdoption
                          adoption={adoption ?? 0}
                          releaseCount={get24hCountByRelease ?? 0}
                          projectCount={get24hCountByProject ?? 0}
                          displayOption={activeDisplay}
                        />
                        <Count value={get24hCountByRelease ?? 0} />
                      </AdoptionWrapper>
                    ) : (
                      <NotAvailable />
                    )}
                  </AdoptionColumn>

                  <CrashFreeRateColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="60px" />
                    ) : defined(crashFreeRate) ? (
                      <CrashFree percent={crashFreeRate} />
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashFreeRateColumn>

                  <CountColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder />
                    ) : hasCountHistogram ? (
                      <ChartWrapper>
                        <HealthStatsChart
                          data={timeSeries}
                          height={20}
                          activeDisplay={activeDisplay}
                        />
                      </ChartWrapper>
                    ) : (
                      <NotAvailable />
                    )}
                  </CountColumn>

                  <CrashesColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="30px" />
                    ) : defined(crashCount) ? (
                      <Tooltip title={t('Open in Issues')}>
                        <GlobalSelectionLink
                          to={getReleaseUnhandledIssuesUrl(
                            organization.slug,
                            project.id,
                            releaseVersion
                          )}
                        >
                          <Count value={crashCount} />
                        </GlobalSelectionLink>
                      </Tooltip>
                    ) : (
                      <NotAvailable />
                    )}
                  </CrashesColumn>

                  <NewIssuesColumn>
                    <Tooltip title={t('Open in Issues')}>
                      <GlobalSelectionLink
                        to={getReleaseNewIssuesUrl(
                          organization.slug,
                          project.id,
                          releaseVersion
                        )}
                      >
                        <Count value={newGroups || 0} />
                      </GlobalSelectionLink>
                    </Tooltip>
                  </NewIssuesColumn>

                  <ViewColumn>
                    <GuideAnchor
                      disabled={!isTopRelease || index !== 0}
                      target="view_release"
                    >
                      <ProjectLink
                        orgSlug={organization.slug}
                        project={project}
                        releaseVersion={releaseVersion}
                        location={location}
                      />
                    </GuideAnchor>
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
  grid-template-columns: 70px 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    grid-template-columns: 90px 1fr;
  }
`;

const CrashFreeRateColumn = styled(Column)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: center;
  }
`;

const CountColumn = styled(Column)`
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
  height: 15px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;
