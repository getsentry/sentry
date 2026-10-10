import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import type {Location} from 'history';
import partition from 'lodash/partition';
import moment from 'moment-timezone';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {COL_WIDTH_MINIMUM, Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Collapsible} from 'sentry/components/collapsible';
import {Panel} from 'sentry/components/panels/panel';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TextOverflow} from 'sentry/components/textOverflow';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {t, tct, tn} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {useUser} from 'sentry/utils/useUser';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {useFinalizeRelease} from 'sentry/views/explore/releases/components/useFinalizeRelease';
import type {ReleasesDisplayOption} from 'sentry/views/explore/releases/list/releasesDisplayOptions';
import type {ReleasesRequestRenderProps} from 'sentry/views/explore/releases/list/releasesRequest';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import type {ReleaseSdkVersion} from 'sentry/views/explore/releases/utils/releaseSdkVersionsApiOptions';

import {ReleaseCardCommits} from './releaseCardCommits';
import {ReleaseCardProjectRow} from './releaseCardProjectRow';
import {ReleaseCardSdkVersion} from './releaseCardSdkVersion';
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
  sdkVersions: ReleaseSdkVersion[];
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
  sdkVersions,
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
        gap={{zero: 'md', '3xl': '0'}}
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
              <ReleaseCardSdkVersion sdkVersions={sdkVersions} />
            </Container>
            <FinalizeWrapper>
              {release.dateReleased ? (
                <Tooltip
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

      <Container borderTop={{zero: 'primary', '3xl': 'none'}} flexGrow={1}>
        <ProjectsTable
          aria-label={t('Projects in release %s', formatVersion(version))}
          columns={getProjectColumns(showReleaseAdoptionStages)}
          header={
            <SimpleTable.HeaderRow>
              <SimpleTable.HeaderCell>{t('Project Slug')}</SimpleTable.HeaderCell>
              {showReleaseAdoptionStages && (
                <SimpleTable.HeaderCell>{t('Adoption Stage')}</SimpleTable.HeaderCell>
              )}
              <AdoptionHeaderCell scope="col" aria-label={t('Adoption')}>
                {t('Adoption')}
                <ReleaseCardStatsPeriod location={location} />
              </AdoptionHeaderCell>
              <SimpleTable.HeaderCell align="right">
                {t('Crash Free Rate')}
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell align="right">
                {t('Crashes')}
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell align="right">
                {t('New Issues')}
              </SimpleTable.HeaderCell>
              <SimpleTable.HeaderCell aria-label={t('View release')} />
            </SimpleTable.HeaderRow>
          }
        >
          <Collapsible
            expandButton={({onExpand, numberOfHiddenItems}) => (
              <SimpleTable.FullWidthRow>
                <Flex justify="center" padding="md">
                  <Button variant="primary" size="xs" onClick={onExpand}>
                    {tct('Show [numberOfHiddenItems] More', {numberOfHiddenItems})}
                  </Button>
                </Flex>
              </SimpleTable.FullWidthRow>
            )}
            collapseButton={({onCollapse}) => (
              <SimpleTable.FullWidthRow>
                <Flex justify="center" padding="md">
                  <Button variant="primary" size="xs" onClick={onCollapse}>
                    {t('Collapse')}
                  </Button>
                </Flex>
              </SimpleTable.FullWidthRow>
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

          {projectsToHide.length > 0 && (
            <SimpleTable.FullWidthRow>
              <Container padding="md xl">
                <Text size="sm" variant="muted">
                  <Tooltip title={getHiddenProjectsTooltip()}>
                    <TextOverflow>
                      {projectsToHide.length === 1
                        ? tct('[number:1] hidden project', {number: <strong />})
                        : tct('[number] hidden projects', {
                            number: <strong>{projectsToHide.length}</strong>,
                          })}
                    </TextOverflow>
                  </Tooltip>
                </Text>
              </Container>
            </SimpleTable.FullWidthRow>
          )}
        </ProjectsTable>
      </Container>
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
      {containerProps => (
        <Panel
          {...props}
          {...containerProps}
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

const ProjectsTable = styled(SimpleTable)`
  border: 0;
`;

const AdoptionHeaderCell = styled(Table.HeadCell)`
  padding: 0 ${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
`;

function getProjectColumns(showReleaseAdoptionStages: boolean): TableColumnConfig[] {
  return [
    {key: 'project', width: `minmax(${COL_WIDTH_MINIMUM}px, 1fr)`},
    ...(showReleaseAdoptionStages
      ? [{key: 'adoptionStage', visible: {'5xl': true}}]
      : []),
    {key: 'adoption', visible: {xl: true}, width: '1fr'},
    {key: 'crashFreeRate'},
    {key: 'crashes', visible: {xl: true}},
    {key: 'newIssues'},
    {key: 'view'},
  ];
}
