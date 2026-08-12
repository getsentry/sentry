import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {Location} from 'history';
import partition from 'lodash/partition';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Collapsible} from 'sentry/components/collapsible';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {TextOverflow} from 'sentry/components/textOverflow';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {t, tct, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {useUser} from 'sentry/utils/useUser';
import {useFinalizeRelease} from 'sentry/views/explore/releases/components/useFinalizeRelease';
import type {ReleasesDisplayOption} from 'sentry/views/explore/releases/list/releasesDisplayOptions';
import type {ReleasesRequestRenderProps} from 'sentry/views/explore/releases/list/releasesRequest';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

import {ReleaseCardCommits} from './releaseCardCommits';
import {ReleaseCardProjectRow} from './releaseCardProjectRow';
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
  return;
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

export function ReleaseCard({
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
    <ResponsivePanel reloading={reloading} data-test-id="release-panel">
      <Stack
        borderRight={{zero: 'none', '3xl': 'primary'}}
        flexShrink={1}
        maxWidth={{zero: 'none', '3xl': '300px'}}
        minWidth={{zero: '0', '3xl': '260px'}}
        padding="lg xl"
        width={{zero: 'auto', '3xl': '22%'}}
      >
        {/* Header/info is the table sidecard */}
        <ReleaseInfoHeader>
          <Link
            to={{
              pathname: makeReleasesPathname({
                organization,
                path: `/${encodeURIComponent(version)}/`,
              }),
              query: {
                environment: location.query.environment,
                project: getReleaseProjectId(release, selection),
              },
            }}
          >
            <Flex align="center">
              <StyledVersion version={version} tooltipRawVersion anchor={false} />
            </Flex>
          </Link>
          {commitCount > 0 && (
            <ReleaseCardCommits release={release} withHeading={false} />
          )}
        </ReleaseInfoHeader>
        <ReleaseInfoSubheader>
          <Flex justify="between" flex="1 1 auto" height="100%">
            <Container flex="1" marginRight="md" minWidth="0" overflow="hidden">
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
            </Container>
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
          </Flex>
        </ReleaseInfoSubheader>
      </Stack>

      <Grid borderTop={{zero: 'primary', '3xl': 'none'}} flexGrow={1}>
        {/* projects is the table */}
        <ReleaseProjectsHeader lightText>
          <Grid
            align="center"
            columns={getReleaseProjectColumns(showReleaseAdoptionStages)}
            gap="0 md"
            width="100%"
          >
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
          </Grid>
        </ReleaseProjectsHeader>

        <Container position="relative">
          <Collapsible
            expandButton={({onExpand, numberOfHiddenItems}) => (
              <ExpandButtonWrapper>
                <Button variant="primary" size="xs" onClick={onExpand}>
                  {tct('Show [numberOfHiddenItems] More', {numberOfHiddenItems})}
                </Button>
              </ExpandButtonWrapper>
            )}
            collapseButton={({onCollapse}) => (
              <Flex justify="center" align="center" height="41px">
                <Button variant="primary" size="xs" onClick={onCollapse}>
                  {t('Collapse')}
                </Button>
              </Flex>
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
        </Container>

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
      </Grid>
    </ResponsivePanel>
  );
}

const StyledVersion = styled(Version)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

function ResponsivePanel({
  reloading,
  ...props
}: React.ComponentProps<typeof Panel> & {reloading: boolean}) {
  return (
    <Container display={{zero: 'block', '3xl': 'flex'}}>
      {({className}) => (
        <Panel
          {...props}
          className={className}
          css={css`
            opacity: ${reloading ? 0.5 : 1};
            pointer-events: ${reloading ? 'none' : 'auto'};
          `}
        />
      )}
    </Container>
  );
}

const ReleaseInfoSubheader = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.colors.gray500};
  flex-grow: 1;
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
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  max-width: 100%;
`;

const ReleaseInfoHeader = styled('div')`
  font-size: ${p => p.theme.font.size.xl};
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: ${p => p.theme.space.xl};
  align-items: center;
`;

const ReleaseProjectsHeader = styled(PanelHeader)`
  border-top-left-radius: 0;
  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};
  font-size: ${p => p.theme.font.size.sm};
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
  border-bottom: ${p => p.theme.space.md} solid ${p => p.theme.tokens.background.primary};
  border-top: ${p => p.theme.space.md} solid transparent;
  border-bottom-right-radius: ${p => p.theme.radius.md};
  @container (max-width: ${p => p.theme.container['3xl']}) {
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }
`;

export function getReleaseProjectColumns(showReleaseAdoptionStages: boolean) {
  const adoptionStagesSize = showReleaseAdoptionStages ? '0.7fr' : '';

  return {
    zero: '1fr 1.4fr 0.6fr 0.7fr',
    xl: '1fr 1fr 1fr 0.5fr 0.5fr 0.5fr',
    '5xl': `1fr ${adoptionStagesSize} 1fr 1fr 0.7fr 0.7fr 0.5fr`,
  } as const;
}

export const ReleaseProjectColumn = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 20px;
`;

export const NewIssuesColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @container (min-width: ${p => p.theme.container.xl}) {
    text-align: right;
  }
`;

const StyledAdoptionColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  & > * {
    flex: 1;
  }
`;

export function AdoptionColumn({children}: {children: React.ReactNode}) {
  return (
    <Container
      display={{zero: 'none', xl: 'flex'}}
      overflow={{zero: 'hidden', xl: 'visible'}}
    >
      {({className}) => (
        <StyledAdoptionColumn className={className}>{children}</StyledAdoptionColumn>
      )}
    </Container>
  );
}

const StyledAdoptionStageColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;
`;

export function AdoptionStageColumn({children}: {children: React.ReactNode}) {
  return (
    <Container
      display={{zero: 'none', '5xl': 'flex'}}
      overflow={{zero: 'hidden', '5xl': 'visible'}}
    >
      {({className}) => (
        <StyledAdoptionStageColumn className={className}>
          {children}
        </StyledAdoptionStageColumn>
      )}
    </Container>
  );
}

export const CrashFreeRateColumn = styled(ReleaseProjectColumn)`
  font-variant-numeric: tabular-nums;

  @container (min-width: ${p => p.theme.container.xl}) {
    text-align: center;
  }

  @container (min-width: ${p => p.theme.container['5xl']}) {
    text-align: right;
  }
`;

export const DisplaySmallCol = styled(ReleaseProjectColumn)`
  display: none;
  font-variant-numeric: tabular-nums;

  @container (min-width: ${p => p.theme.container.xl}) {
    display: block;
    text-align: right;
  }
`;

const HiddenProjectsMessage = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  padding: 0 ${p => p.theme.space.xl};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  overflow: hidden;
  height: 24px;
  line-height: 24px;
  color: ${p => p.theme.tokens.content.secondary};
  background-color: ${p => p.theme.tokens.background.secondary};
  border-bottom-right-radius: ${p => p.theme.radius.md};
  @container (max-width: ${p => p.theme.container['3xl']}) {
    border-bottom-left-radius: ${p => p.theme.radius.md};
  }
`;
