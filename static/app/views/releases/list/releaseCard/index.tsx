import {Component} from 'react';
import styled from '@emotion/styled';
import color from 'color';
import {Location} from 'history';
import partition from 'lodash/partition';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import Button from 'sentry/components/button';
import Collapsible from 'sentry/components/collapsible';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import {Panel, PanelHeader} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {t, tct, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters, Release} from 'sentry/types';

import {ReleasesDisplayOption} from '../releasesDisplayOptions';
import {ReleasesRequestRenderProps} from '../releasesRequest';

import ReleaseCardCommits from './releaseCardCommits';
import ReleaseCardProjectRow from './releaseCardProjectRow';
import ReleaseCardStatsPeriod from './releaseCardStatsPeriod';

function getReleaseProjectId(release: Release, selection: PageFilters) {
  // if a release has only one project
  if (release.projects.length === 1) {
    return release.projects[0].id;
  }

  // if only one project is selected in global header and release has it (second condition will prevent false positives like -1)
  if (
    selection.projects.length === 1 &&
    release.projects.map(p => p.id).includes(selection.projects[0])
  ) {
    return selection.projects[0];
  }

  // project selector on release detail page will pick it up
  return undefined;
}

type Props = {
  activeDisplay: ReleasesDisplayOption;
  getHealthData: ReleasesRequestRenderProps['getHealthData'];
  isTopRelease: boolean;
  location: Location;
  organization: Organization;
  release: Release;
  reloading: boolean;
  selection: PageFilters;
  showHealthPlaceholders: boolean;
  showReleaseAdoptionStages: boolean;
};

class ReleaseCard extends Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    // we don't want project health rows to reorder/jump while the whole card is loading
    if (this.props.reloading && nextProps.reloading) {
      return false;
    }

    return true;
  }

  render() {
    const {
      release,
      organization,
      activeDisplay,
      location,
      reloading,
      selection,
      showHealthPlaceholders,
      isTopRelease,
      getHealthData,
      showReleaseAdoptionStages,
    } = this.props;
    const {version, commitCount, lastDeploy, dateCreated, versionInfo} = release;

    // sort health rows inside release card alphabetically by project name,
    // show only the ones that are selected in global header
    const [projectsToShow, projectsToHide] = partition(
      release.projects.sort((a, b) => a.slug.localeCompare(b.slug)),
      p =>
        // do not filter for My Projects & All Projects
        selection.projects.length > 0 && !selection.projects.includes(-1)
          ? selection.projects.includes(p.id)
          : true
    );

    function getHiddenProjectsTooltip() {
      const limitedProjects = projectsToHide.map(p => p.slug).slice(0, 5);
      const remainderLength = projectsToHide.length - limitedProjects.length;

      if (remainderLength) {
        limitedProjects.push(tn('and %s more', 'and %s more', remainderLength));
      }

      return limitedProjects.join(', ');
    }

    return (
      <StyledPanel reloading={reloading ? 1 : 0} data-test-id="release-panel">
        <ReleaseInfo>
          <ReleaseInfoHeader>
            <GlobalSelectionLink
              to={{
                pathname: `/organizations/${
                  organization.slug
                }/releases/${encodeURIComponent(version)}/`,
                query: {project: getReleaseProjectId(release, selection)},
              }}
            >
              <GuideAnchor
                disabled={!isTopRelease || projectsToShow.length > 1}
                target="release_version"
              >
                <VersionWrapper>
                  <StyledVersion version={version} tooltipRawVersion anchor={false} />
                </VersionWrapper>
              </GuideAnchor>
            </GlobalSelectionLink>
            {commitCount > 0 && (
              <ReleaseCardCommits release={release} withHeading={false} />
            )}
          </ReleaseInfoHeader>
          <ReleaseInfoSubheader>
            {versionInfo?.package && (
              <PackageName ellipsisDirection="left">{versionInfo.package}</PackageName>
            )}
            <TimeSince date={lastDeploy?.dateFinished || dateCreated} />
            {lastDeploy?.dateFinished && ` \u007C ${lastDeploy.environment}`}
          </ReleaseInfoSubheader>
        </ReleaseInfo>

        <ReleaseProjects>
          <ReleaseProjectsHeader lightText>
            <ReleaseProjectsLayout showReleaseAdoptionStages={showReleaseAdoptionStages}>
              <ReleaseProjectColumn>{t('Project Name')}</ReleaseProjectColumn>
              {showReleaseAdoptionStages && (
                <AdoptionStageColumn>{t('Adoption Stage')}</AdoptionStageColumn>
              )}
              <AdoptionColumn>
                <span>{t('Adoption')}</span>
                <ReleaseCardStatsPeriod location={location} />
              </AdoptionColumn>
              <CrashFreeRateColumn>{t('Crash Free Rate')}</CrashFreeRateColumn>
              <CrashesColumn>{t('Crashes')}</CrashesColumn>
              <NewIssuesColumn>{t('New Issues')}</NewIssuesColumn>
            </ReleaseProjectsLayout>
          </ReleaseProjectsHeader>

          <ProjectRows>
            <Collapsible
              expandButton={({onExpand, numberOfHiddenItems}) => (
                <ExpandButtonWrapper>
                  <Button priority="primary" size="xs" onClick={onExpand}>
                    {tct('Show [numberOfHiddenItems] More', {numberOfHiddenItems})}
                  </Button>
                </ExpandButtonWrapper>
              )}
              collapseButton={({onCollapse}) => (
                <CollapseButtonWrapper>
                  <Button priority="primary" size="xs" onClick={onCollapse}>
                    {t('Collapse')}
                  </Button>
                </CollapseButtonWrapper>
              )}
            >
              {projectsToShow.map((project, index) => (
                <ReleaseCardProjectRow
                  key={`${release.version}-${project.slug}-row`}
                  index={index}
                  organization={organization}
                  project={project}
                  location={location}
                  getHealthData={getHealthData}
                  releaseVersion={release.version}
                  activeDisplay={activeDisplay}
                  showPlaceholders={showHealthPlaceholders}
                  showReleaseAdoptionStages={showReleaseAdoptionStages}
                  isTopRelease={isTopRelease}
                  adoptionStages={release.adoptionStages}
                />
              ))}
            </Collapsible>
          </ProjectRows>

          {projectsToHide.length > 0 && (
            <HiddenProjectsMessage data-test-id="hidden-projects">
              <Tooltip title={getHiddenProjectsTooltip()}>
                <TextOverflow>
                  {projectsToHide.length === 1
                    ? tct('[number:1] hidden project', {number: <strong />})
                    : tct('[number] hidden projects', {
                        number: <strong>{projectsToHide.length}</strong>,
                      })}
                </TextOverflow>
              </Tooltip>
            </HiddenProjectsMessage>
          )}
        </ReleaseProjects>
      </StyledPanel>
    );
  }
}

const VersionWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const StyledVersion = styled(Version)`
  ${p => p.theme.overflowEllipsis};
`;

const StyledPanel = styled(Panel)<{reloading: number}>`
  opacity: ${p => (p.reloading ? 0.5 : 1)};
  pointer-events: ${p => (p.reloading ? 'none' : 'auto')};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: flex;
  }
`;

const ReleaseInfo = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  flex-shrink: 0;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    border-right: 1px solid ${p => p.theme.border};
    min-width: 260px;
    width: 22%;
    max-width: 300px;
  }
`;

const ReleaseInfoSubheader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray400};
`;

const PackageName = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
`;

const ReleaseProjects = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  flex-grow: 1;
  display: grid;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    border-top: none;
  }
`;

const ReleaseInfoHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: ${space(2)};
  align-items: center;
`;

const ReleaseProjectsHeader = styled(PanelHeader)`
  border-top-left-radius: 0;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

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
    ${p => color(p.theme.background).alpha(0).string()} 0,
    ${p => p.theme.background}
  );
  background-repeat: repeat-x;
  border-bottom: ${space(1)} solid ${p => p.theme.background};
  border-top: ${space(1)} solid transparent;
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }
`;

const CollapseButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 41px;
`;

export const ReleaseProjectsLayout = styled('div')<{showReleaseAdoptionStages?: boolean}>`
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.6fr 0.7fr;

  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
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

export const ReleaseProjectColumn = styled('div')`
  ${p => p.theme.overflowEllipsis};
  line-height: 20px;
`;

export const NewIssuesColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    text-align: right;
  }
`;

export const AdoptionColumn = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    /* Chart tooltips need overflow */
    overflow: visible;
  }

  & > * {
    flex: 1;
  }
`;

export const AdoptionStageColumn = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    display: flex;

    /* Need to show the edges of the tags */
    overflow: visible;
  }
`;

export const CrashFreeRateColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    text-align: center;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    text-align: right;
  }
`;

export const CrashesColumn = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
    text-align: right;
  }
`;

const HiddenProjectsMessage = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
  padding: 0 ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  overflow: hidden;
  height: 24px;
  line-height: 24px;
  color: ${p => p.theme.gray300};
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }
`;

export default ReleaseCard;
