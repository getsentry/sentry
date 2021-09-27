import {Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Collapsible from 'app/components/collapsible';
import Count from 'app/components/count';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import ExternalLink from 'app/components/links/externalLink';
import Link from 'app/components/links/link';
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
import {Theme} from 'app/utils/theme';
import {isProjectMobileForReleases} from 'app/views/releases/list';

import {getReleaseNewIssuesUrl, getReleaseUnhandledIssuesUrl} from '../../utils';
import {ReleaseHealthRequestRenderProps} from '../../utils/releaseHealthRequest';
import CrashFree from '../crashFree';
import HealthStatsChart from '../healthStatsChart';
import HealthStatsPeriod from '../healthStatsPeriod';
import {DisplayOption} from '../utils';

import Header from './header';
import ProjectLink from './projectLink';

const adoptionStagesLink = (
  <ExternalLink href="https://docs.sentry.io/product/releases/health/#adoption-stages" />
);

export const ADOPTION_STAGE_LABELS: Record<
  string,
  {name: string; tooltipTitle: JSX.Element; type: keyof Theme['tag']}
> = {
  low_adoption: {
    name: t('Low Adoption'),
    tooltipTitle: tct(
      'This release has a low percentage of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
    type: 'warning',
  },
  adopted: {
    name: t('Adopted'),
    tooltipTitle: tct(
      'This release has a high percentage of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
    type: 'success',
  },
  replaced: {
    name: t('Replaced'),
    tooltipTitle: tct(
      'This release was previously Adopted, but now has a lower level of sessions compared to other releases in this project. [link:Learn more]',
      {link: adoptionStagesLink}
    ),
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
  isTopRelease: boolean;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
  showReleaseAdoptionStages: boolean;
  adoptionStages?: Release['adoptionStages'];
};

const Content = ({
  projects,
  showReleaseAdoptionStages,
  adoptionStages,
  releaseVersion,
  location,
  organization,
  activeDisplay,
  showPlaceholders,
  isTopRelease,
  getHealthData,
}: Props) => (
  <Fragment>
    <Header>
      <Layout showReleaseAdoptionStages={showReleaseAdoptionStages}>
        <Column>{t('Project Name')}</Column>
        {showReleaseAdoptionStages && (
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

          const adoptionStage =
            showReleaseAdoptionStages &&
            adoptionStages?.[project.slug] &&
            adoptionStages?.[project.slug].stage;

          const isMobileProject = isProjectMobileForReleases(project.platform);
          const adoptionStageLabel =
            Boolean(get24hCountByProject && adoptionStage && isMobileProject) &&
            ADOPTION_STAGE_LABELS[adoptionStage];

          return (
            <ProjectRow key={`${releaseVersion}-${slug}-health`}>
              <Layout showReleaseAdoptionStages={showReleaseAdoptionStages}>
                <Column>
                  <ProjectBadge project={project} avatarSize={16} />
                </Column>

                {showReleaseAdoptionStages && (
                  <AdoptionStageColumn>
                    {adoptionStageLabel ? (
                      <Link
                        to={{
                          pathname: `/organizations/${organization.slug}/releases/`,
                          query: {
                            ...location.query,
                            query: `release.stage:${adoptionStage}`,
                          },
                        }}
                      >
                        <Tooltip title={adoptionStageLabel.tooltipTitle}>
                          <Tag type={adoptionStageLabel.type}>
                            {adoptionStageLabel.name}
                          </Tag>
                        </Tooltip>
                      </Link>
                    ) : (
                      <NotAvailable />
                    )}
                  </AdoptionStageColumn>
                )}

                <AdoptionColumn>
                  {showPlaceholders ? (
                    <StyledPlaceholder width="100px" />
                  ) : (
                    <AdoptionWrapper>
                      <span>{adoption ? Math.round(adoption) : '0'}%</span>
                      <HealthStatsChart
                        data={timeSeries}
                        height={20}
                        activeDisplay={activeDisplay}
                      />
                    </AdoptionWrapper>
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
  </Fragment>
);

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

const Layout = styled('div')<{showReleaseAdoptionStages?: boolean}>`
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.6fr 0.7fr;

  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    ${p =>
      p.showReleaseAdoptionStages
        ? `
      grid-template-columns: 1fr 0.7fr 1fr 1fr 0.7fr 0.7fr 0.5fr;
    `
        : `
      grid-template-columns: 1fr 1fr 1fr 0.7fr 0.7fr 0.5fr;
    `}
  }
`;

const Column = styled('div')`
  ${overflowEllipsis};
  line-height: 20px;
`;

const NewIssuesColumn = styled(Column)`
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: right;
  }
`;

const AdoptionColumn = styled(Column)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }

  & > * {
    flex: 1;
  }
`;

const AdoptionStageColumn = styled(Column)`
  display: none;
  font-variant-numeric: tabular-nums;

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
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    text-align: center;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    text-align: right;
  }
`;

const CrashesColumn = styled(Column)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
    text-align: right;
  }
`;

const ViewColumn = styled(Column)`
  text-align: right;
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 15px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;
