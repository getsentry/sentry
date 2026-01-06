import {useMemo} from 'react';
import styled from '@emotion/styled';
import color from 'color';
import type {Location} from 'history';
import partition from 'lodash/partition';
import moment from 'moment-timezone';

import {Flex} from '@sentry/scraps/layout';

import Collapsible from 'sentry/components/collapsible';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {useUser} from 'sentry/utils/useUser';
import useFinalizeRelease from 'sentry/views/releases/components/useFinalizeRelease';
import type {ReleasesDisplayOption} from 'sentry/views/releases/list/releasesDisplayOptions';
import type {ReleasesRequestRenderProps} from 'sentry/views/releases/list/releasesRequest';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import ReleaseCardCommits from './releaseCardCommits';
import ReleaseCardProjectRow from './releaseCardProjectRow';
import ReleaseCardStatsPeriod from './releaseCardStatsPeriod';

function getReleaseProjectId(release: Release, selection: PageFilters) {
  // if a release has only one project
  if (release.projects.length === 1) {
    return release.projects[0]!.id;
  }

  // if only one project is selected in global header and release has it (second condition will prevent false positives like -1)
  if (
    selection.projects.length === 1 &&
    release.projects.map(p => p.id).includes(selection.projects[0]!)
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

function ReleaseCard({
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
}: Props) {
  const user = useUser();
  const options = user ? user.options : null;

  const finalizeRelease = useFinalizeRelease();

  const {
    version,
    commitCount,
    lastDeploy,
    dateCreated,
    versionInfo,
    adoptionStages,
    projects,
  } = release;

  const [projectsToShow, projectsToHide] = useMemo(() => {
    // sort health rows inside release card alphabetically by project name,
    // show only the ones that are selected in global header
    return partition(
      projects.sort((a, b) => a.slug.localeCompare(b.slug)),
      p =>
        // do not filter for My Projects & All Projects
        selection.projects.length > 0 && !selection.projects.includes(-1)
          ? selection.projects.includes(p.id)
          : true
    );
  }, [projects, selection.projects]);

  const getHiddenProjectsTooltip = () => {
    const limitedProjects = projectsToHide.map(p => p.slug).slice(0, 5);
    const remainderLength = projectsToHide.length - limitedProjects.length;

    if (remainderLength) {
      limitedProjects.push(tn('and %s more', 'and %s more', remainderLength));
    }

    return limitedProjects.join(', ');
  };

  return (
    <StyledPanel reloading={reloading ? 1 : 0} data-test-id="release-panel">
      <ReleaseInfo>
        {/* Header/info is the table sidecard */}
        <ReleaseInfoHeader>
          <GlobalSelectionLink
            to={{
              pathname: makeReleasesPathname({
                organization,
                path: `/${encodeURIComponent(version)}/`,
              }),
              query: {project: getReleaseProjectId(release, selection)},
            }}
          >
            <Flex align="center">
              <StyledVersion version={version} tooltipRawVersion anchor={false} />
            </Flex>
          </GlobalSelectionLink>
          {commitCount > 0 && (
            <ReleaseCardCommits release={release} withHeading={false} />
          )}
        </ReleaseInfoHeader>
        <ReleaseInfoSubheader>
          <ReleaseInfoSubheaderUpper>
            <PackageContainer>
              <PackageName>
                {versionInfo?.package && (
                  <TextOverflow ellipsisDirection="right">
                    {versionInfo.package}
                  </TextOverflow>
                )}
              </PackageName>
              <TimeSince
                tooltipPrefix={lastDeploy?.dateFinished ? t('Finished:') : t('Created:')}
                date={lastDeploy?.dateFinished || dateCreated}
              />
              {lastDeploy?.dateFinished && ` \u007C ${lastDeploy.environment}`}
              &nbsp;
            </PackageContainer>
            <FinalizeWrapper>
              {release.dateReleased ? (
                <Tooltip
                  isHoverable
                  title={tct('This release was finalized on [date]. [docs:Read More].', {
                    date: moment(release.dateReleased).format(
                      options?.clock24Hours
                        ? 'MMMM D, YYYY HH:mm z'
                        : 'MMMM D, YYYY h:mm A z'
                    ),
                    docs: (
                      <ExternalLink href="https://docs.sentry.io/cli/releases/#finalizing-releases" />
                    ),
                  })}
                >
                  <Tag variant="success" icon={<IconCheckmark />} />
                </Tooltip>
              ) : (
                <Tooltip
                  isHoverable
                  title={tct(
                    'Set release date to [date].[br]Finalizing a release means that we populate a second timestamp on the release record, which is prioritized over [code:date_created] when sorting releases. [docs:Read more].',
                    {
                      date: moment(release.firstEvent ?? release.dateCreated).format(
                        options?.clock24Hours
                          ? 'MMMM D, YYYY HH:mm z'
                          : 'MMMM D, YYYY h:mm A z'
                      ),
                      br: <br />,
                      code: <code />,
                      docs: (
                        <ExternalLink href="https://docs.sentry.io/cli/releases/#finalizing-releases" />
                      ),
                    }
                  )}
                >
                  <Button
                    size="xs"
                    onClick={() =>
                      finalizeRelease.mutate([release], {
                        onSettled() {
                          window.location.reload();
                        },
                      })
                    }
                  >
                    {t('Finalize')}
                  </Button>
                </Tooltip>
              )}
            </FinalizeWrapper>
          </ReleaseInfoSubheaderUpper>
        </ReleaseInfoSubheader>
      </ReleaseInfo>

      <ReleaseProjects>
        {/* projects is the table */}
        <ReleaseProjectsHeader lightText>
          <ReleaseProjectsLayout showReleaseAdoptionStages={showReleaseAdoptionStages}>
            <ReleaseProjectColumn>{t('Project Slug')}</ReleaseProjectColumn>
            {showReleaseAdoptionStages && (
              <AdoptionStageColumn>{t('Adoption Stage')}</AdoptionStageColumn>
            )}
            <AdoptionColumn>
              <span>{t('Adoption')}</span>
              <ReleaseCardStatsPeriod location={location} />
            </AdoptionColumn>
            <CrashFreeRateColumn>{t('Crash Free Rate')}</CrashFreeRateColumn>
            <DisplaySmallCol>{t('Crashes')}</DisplaySmallCol>
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
            {projectsToShow.map((project, index) => {
              const key = `${project.slug}-${version}`;
              return (
                <ReleaseCardProjectRow
                  key={`${key}-row`}
                  activeDisplay={activeDisplay}
                  adoptionStages={adoptionStages}
                  getHealthData={getHealthData}
                  index={index}
                  isTopRelease={isTopRelease}
                  location={location}
                  organization={organization}
                  project={project}
                  releaseVersion={version}
                  showPlaceholders={showHealthPlaceholders}
                  showReleaseAdoptionStages={showReleaseAdoptionStages}
                />
              );
            })}
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

const StyledVersion = styled(Version)`
  ${p => p.theme.overflowEllipsis};
`;

const StyledPanel = styled(Panel)<{reloading: number}>`
  opacity: ${p => (p.reloading ? 0.5 : 1)};
  pointer-events: ${p => (p.reloading ? 'none' : 'auto')};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: flex;
  }
`;

const ReleaseInfo = styled('div')`
  padding: ${space(1.5)} ${space(2)};
  flex-shrink: 1;
  display: flex;
  flex-direction: column;
  justify-content: stretch;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-right: 1px solid ${p => p.theme.border};
    min-width: 260px;
    width: 22%;
    max-width: 300px;
  }
`;

const ReleaseInfoSubheader = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.colors.gray500};
  flex-grow: 1;
`;

const ReleaseInfoSubheaderUpper = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  flex: initial;
  flex-grow: 1;
  height: 100%;
`;
const FinalizeWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  flex: initial;
  position: relative;
  width: 80px;
  margin-left: auto;

  & > * {
    position: absolute;
    right: 0;
  }
`;

const PackageName = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  max-width: 100%;
`;

const PackageContainer = styled('div')`
  overflow: hidden;
  flex: 1;
  min-width: 0;
  margin-right: ${space(1)};
`;

const ReleaseProjects = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  flex-grow: 1;
  display: grid;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    border-top: none;
  }
`;

const ReleaseInfoHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: ${space(2)};
  align-items: center;
`;

const ReleaseProjectsHeader = styled(PanelHeader)`
  border-top-left-radius: 0;
  padding: ${space(1.5)} ${space(2)};
  font-size: ${p => p.theme.fontSize.sm};
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
    ${p => color(p.theme.tokens.background.primary).alpha(0).string()} 0,
    ${p => p.theme.tokens.background.primary}
  );
  background-repeat: repeat-x;
  border-bottom: ${space(1)} solid ${p => p.theme.tokens.background.primary};
  border-top: ${space(1)} solid transparent;
  border-bottom-right-radius: ${p => p.theme.radius.md};
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }
`;

const CollapseButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 41px;
`;

export const ReleaseProjectsLayout = styled('div')<{
  showReleaseAdoptionStages?: boolean;
}>`
  display: grid;
  grid-template-columns: 1fr 1.4fr 0.6fr 0.7fr;

  grid-column-gap: ${space(1)};
  align-items: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr 1fr 1fr 0.5fr 0.5fr 0.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    ${p => {
      const adoptionStagesSize = p.showReleaseAdoptionStages ? '0.7fr' : '';
      return `grid-template-columns: 1fr ${adoptionStagesSize} 1fr 1fr 0.7fr 0.7fr 0.5fr`;
    }}
  }
`;

export const ReleaseProjectColumn = styled('div')`
  ${p => p.theme.overflowEllipsis};
  line-height: 20px;
`;

export const NewIssuesColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    text-align: right;
  }
`;

export const AdoptionColumn = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
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

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    display: flex;

    /* Need to show the edges of the tags */
    overflow: visible;
  }
`;

export const CrashFreeRateColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    text-align: center;
  }

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    text-align: right;
  }
`;

export const DisplaySmallCol = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: block;
    text-align: right;
  }
`;

const HiddenProjectsMessage = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  padding: 0 ${space(2)};
  border-top: 1px solid ${p => p.theme.border};
  overflow: hidden;
  height: 24px;
  line-height: 24px;
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.backgroundSecondary};
  border-bottom-right-radius: ${p => p.theme.radius.md};
  @media (max-width: ${p => p.theme.breakpoints.md}) {
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }
`;

export default ReleaseCard;
