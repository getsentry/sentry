import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import NotAvailable from 'app/components/notAvailable';
import {PanelItem} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import Tag from 'app/components/tag';
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
import {DisplayOption} from '../utils';

import Header from './header';

const ADOPTION_STAGE_LABELS = {
  not_adopted: {
    name: t('Low Adoption'),
    type: 'warning',
  },
  adopted: {
    name: t('Adopted'),
    type: 'success',
  },
  replaced: {
    name: t('Replaced'),
    type: 'default',
  },
};

type Props = {
  projects: Array<ReleaseProject>;
  releaseVersion: Release['version'];
  organization: Organization;
  activeDisplay: DisplayOption;
  location: Location;
  showPlaceholders: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
  showAdoptionStageLabels: boolean;
  adoptionStages?: Release['adoptionStages'];
};

const Content = ({
  projects,
  showAdoptionStageLabels,
  adoptionStages,
  releaseVersion,
  location,
  organization,
  activeDisplay,
  showPlaceholders,
  getHealthData,
}: Props) => {
  const hasAdoptionStages: boolean =
    showAdoptionStageLabels && adoptionStages !== undefined;
  return (
    <Fragment>
      <Header>
        <Layout hasAdoptionStages={hasAdoptionStages}>
          <Column>{t('Project Name')}</Column>
          {hasAdoptionStages && (
            <AdoptionStageColumn>{t('Adoption Stage')}</AdoptionStageColumn>
          )}
          <AdoptionColumn>
            <span>{t('Adoption')}</span>
            <HealthStatsPeriod location={location} />
          </AdoptionColumn>
          <CrashFreeRateColumn>{t('Crash Free Rate')}</CrashFreeRateColumn>
          <CrashesColumn>{t('Crashes')}</CrashesColumn>
          <NewIssuesColumn>{t('New Issues')}</NewIssuesColumn>
        </Layout>
      </Header>

      <ProjectRows>
        <Collapsible
          expandButton={({onExpand, numberOfHiddenItems}) => (
            <ExpandButtonWrapper>
              <Button priority="primary" size="xsmall" onClick={onExpand}>
                {tct('Show [numberOfHiddenItems] More', {numberOfHiddenItems})}
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

            const adoptionStage =
              hasAdoptionStages &&
              adoptionStages?.[project.slug] &&
              adoptionStages?.[project.slug].stage;

            return (
              <ProjectRow key={`${releaseVersion}-${slug}-health`}>
                <Layout hasAdoptionStages={hasAdoptionStages}>
                  <Column>
                    <ProjectBadge project={project} avatarSize={16} />
                  </Column>

                  {hasAdoptionStages && (
                    <AdoptionStageColumn>
                      {adoptionStages?.[project.slug] ? (
                        <Tag type={ADOPTION_STAGE_LABELS[adoptionStage].type}>
                          {ADOPTION_STAGE_LABELS[adoptionStage].name}
                        </Tag>
                      ) : (
                        <NotAvailable />
                      )}
                    </AdoptionStageColumn>
                  )}

                  <AdoptionColumn>
                    {showPlaceholders ? (
                      <StyledPlaceholder width="100px" />
                    ) : adoption && hasCountHistogram ? (
                      <AdoptionWrapper>
                        <span>{Math.round(adoption)}%</span>
                        <HealthStatsChart
                          data={timeSeries}
                          height={20}
                          activeDisplay={activeDisplay}
                        />
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
                </Layout>
              </ProjectRow>
            );
          })}
        </Collapsible>
      </ProjectRows>
    </Fragment>
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

const Layout = styled('div')<{hasAdoptionStages?: boolean}>`
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.6fr;

  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    ${p =>
      p.hasAdoptionStages
        ? `
      grid-template-columns: 1fr 0.5fr 1fr 1fr 0.5fr 0.5fr;
    `
        : `
      grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr;
    `}
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

const AdoptionStageColumn = styled(Column)`
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    display: flex;

    /* Need to show the edges of the tags */
    overflow: visible;
  }
`;

const AdoptionWrapper = styled('span')`
  flex: 1;
  display: inline-grid;
  grid-template-columns: 30px 1fr;
  grid-gap: ${space(1)};
  align-items: center;

  /* Chart tooltips need overflow */
  overflow: visible;
`;

const CrashFreeRateColumn = styled(Column)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: center;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    text-align: right;
  }
`;

const CrashesColumn = styled(Column)`
  display: none;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    text-align: right;
  }
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 15px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;
