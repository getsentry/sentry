import LazyLoad from 'react-lazyload';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {LinkButton} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import {Tag} from 'sentry/components/core/badge/tag';
import Count from 'sentry/components/count';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import NotAvailable from 'sentry/components/notAvailable';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconFire, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseProject} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import type {IconSize} from 'sentry/utils/theme';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

import {
  ADOPTION_STAGE_LABELS,
  displayCrashFreePercent,
  getReleaseNewIssuesUrl,
  getReleaseUnhandledIssuesUrl,
  isMobileRelease,
} from '../../utils';
import {ReleasesDisplayOption} from '../releasesDisplayOptions';
import type {ReleasesRequestRenderProps} from '../releasesRequest';

import {
  AdoptionColumn,
  AdoptionStageColumn,
  CrashFreeRateColumn,
  DisplaySmallCol,
  NewIssuesColumn,
  ReleaseProjectColumn,
  ReleaseProjectsLayout,
} from '.';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

function getCrashFreeIcon(crashFreePercent: number, iconSize: IconSize = 'sm') {
  if (crashFreePercent < CRASH_FREE_DANGER_THRESHOLD) {
    return <IconFire color="errorText" size={iconSize} />;
  }

  if (crashFreePercent < CRASH_FREE_WARNING_THRESHOLD) {
    return <IconWarning color="warningText" size={iconSize} />;
  }

  return <IconCheckmark isCircled color="successText" size={iconSize} />;
}

type Props = {
  activeDisplay: ReleasesDisplayOption;
  getHealthData: ReleasesRequestRenderProps['getHealthData'];
  index: number;
  isTopRelease: boolean;
  location: Location;
  organization: Organization;
  project: ReleaseProject;
  releaseVersion: string;
  showPlaceholders: boolean;
  showReleaseAdoptionStages: boolean;
  adoptionStages?: Release['adoptionStages'];
};

function ReleaseCardProjectRow({
  activeDisplay,
  adoptionStages,
  getHealthData,
  index,
  isTopRelease,
  location,
  organization,
  project,
  releaseVersion,
  showPlaceholders,
  showReleaseAdoptionStages,
}: Props) {
  const theme = useTheme();
  const {id, newGroups} = project;

  const crashCount = getHealthData.getCrashCount(
    releaseVersion,
    id,
    ReleasesDisplayOption.SESSIONS
  );

  const crashFreeRate = getHealthData.getCrashFreeRate(releaseVersion, id, activeDisplay);
  const get24hCountByProject = getHealthData.get24hCountByProject(id, activeDisplay);
  const timeSeries = getHealthData.getTimeSeries(releaseVersion, id, activeDisplay);
  const adoption = getHealthData.getAdoption(releaseVersion, id, activeDisplay);

  const adoptionStage =
    showReleaseAdoptionStages &&
    adoptionStages?.[project.slug] &&
    adoptionStages?.[project.slug]!.stage;

  const adoptionStageLabel =
    get24hCountByProject && adoptionStage && isMobileRelease(project.platform)
      ? ADOPTION_STAGE_LABELS[adoptionStage]
      : null;

  return (
    <ProjectRow data-test-id="release-card-project-row">
      <ReleaseProjectsLayout showReleaseAdoptionStages={showReleaseAdoptionStages}>
        <ReleaseProjectColumn>
          <ProjectBadge project={project} avatarSize={16} />
        </ReleaseProjectColumn>

        {showReleaseAdoptionStages && (
          <AdoptionStageColumn>
            {adoptionStageLabel ? (
              <Tooltip title={adoptionStageLabel.tooltipTitle} isHoverable>
                <Link
                  to={{
                    pathname: makeReleasesPathname({
                      organization,
                      path: '/',
                    }),
                    query: {
                      ...location.query,
                      query: `release.stage:${adoptionStage}`,
                    },
                  }}
                >
                  <Tag type={adoptionStageLabel.type}>{adoptionStageLabel.name}</Tag>
                </Link>
              </Tooltip>
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
              <LazyLoad debounce={50} height={20}>
                <MiniBarChart
                  series={timeSeries}
                  height={20}
                  isGroupedByDate
                  showTimeInTooltip
                  hideDelay={50}
                  tooltipFormatter={(value: number) => {
                    const suffix =
                      activeDisplay === ReleasesDisplayOption.USERS
                        ? tn('user', 'users', value)
                        : tn('session', 'sessions', value);

                    return `${value.toLocaleString()} ${suffix}`;
                  }}
                  colors={[theme.purple300, theme.gray200]}
                />
              </LazyLoad>
            </AdoptionWrapper>
          )}
        </AdoptionColumn>

        <CrashFreeRateColumn>
          {showPlaceholders ? (
            <StyledPlaceholder width="60px" />
          ) : defined(crashFreeRate) ? (
            <CrashFreeWrapper>
              {getCrashFreeIcon(crashFreeRate)}
              {displayCrashFreePercent(crashFreeRate)}
            </CrashFreeWrapper>
          ) : (
            <NotAvailable />
          )}
        </CrashFreeRateColumn>

        <DisplaySmallCol>
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
        </DisplaySmallCol>

        <NewIssuesColumn>
          <Tooltip title={t('Open in Issues')}>
            <GlobalSelectionLink
              to={getReleaseNewIssuesUrl(organization.slug, project.id, releaseVersion)}
            >
              <Count value={newGroups || 0} />
            </GlobalSelectionLink>
          </Tooltip>
        </NewIssuesColumn>

        <ViewColumn>
          <GuideAnchor disabled={!isTopRelease || index !== 0} target="view_release">
            <LinkButton
              size="xs"
              to={{
                pathname: makeReleasesPathname({
                  organization,
                  path: `/${encodeURIComponent(releaseVersion)}/`,
                }),
                query: {
                  ...extractSelectionParameters(location.query),
                  project: project.id,
                  yAxis: undefined,
                },
              }}
            >
              {t('View')}
            </LinkButton>
          </GuideAnchor>
        </ViewColumn>
      </ReleaseProjectsLayout>
    </ProjectRow>
  );
}

export default ReleaseCardProjectRow;

const ProjectRow = styled(PanelItem)`
  padding: ${space(1)} ${space(2)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

const StyledPlaceholder = styled(Placeholder)`
  height: 15px;
  display: inline-block;
  position: relative;
  top: ${space(0.25)};
`;

const AdoptionWrapper = styled('span')`
  flex: 1;
  display: inline-grid;
  grid-template-columns: 30px 1fr;
  gap: ${space(1)};
  align-items: center;

  /* Chart tooltips need overflow */
  overflow: visible;
`;

const CrashFreeWrapper = styled('div')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(1)};
  align-items: center;
  vertical-align: middle;
`;

const ViewColumn = styled('div')`
  ${p => p.theme.overflowEllipsis};
  line-height: 20px;
  text-align: right;
`;
