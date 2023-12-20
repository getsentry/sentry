import {useMemo} from 'react';
import LazyLoad from 'react-lazyload';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {Button} from 'sentry/components/button';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import Count from 'sentry/components/count';
import GlobalSelectionLink from 'sentry/components/globalSelectionLink';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import NotAvailable from 'sentry/components/notAvailable';
import {extractSelectionParameters} from 'sentry/components/organizations/pageFilters/utils';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import Tag from 'sentry/components/tag';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconFire, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Deploy, Organization, Release, ReleaseProject} from 'sentry/types';
import {defined} from 'sentry/utils';
import type {IconSize} from 'sentry/utils/theme';

import {
  ADOPTION_STAGE_LABELS,
  displayCrashFreePercent,
  getReleaseNewIssuesUrl,
  getReleaseUnhandledIssuesUrl,
  isMobileRelease,
} from '../../utils';
import {ThresholdStatus} from '../../utils/types';
import {ReleasesDisplayOption} from '../releasesDisplayOptions';
import {ReleasesRequestRenderProps} from '../releasesRequest';

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
  expectedThresholds: number;
  getHealthData: ReleasesRequestRenderProps['getHealthData'];
  hasThresholds: boolean;
  index: number;
  isTopRelease: boolean;
  location: Location;
  organization: Organization;
  project: ReleaseProject;
  releaseVersion: string;
  showPlaceholders: boolean;
  showReleaseAdoptionStages: boolean;
  thresholdStatuses: ThresholdStatus[];
  adoptionStages?: Release['adoptionStages'];
  lastDeploy?: Deploy | undefined;
};

function ReleaseCardProjectRow({
  activeDisplay,
  adoptionStages,
  expectedThresholds,
  getHealthData,
  hasThresholds,
  index,
  isTopRelease,
  lastDeploy,
  location,
  organization,
  project,
  releaseVersion,
  showPlaceholders,
  showReleaseAdoptionStages,
  thresholdStatuses,
}: Props) {
  const theme = useTheme();
  const {id, newGroups} = project;

  const crashCount = getHealthData.getCrashCount(
    releaseVersion,
    id,
    ReleasesDisplayOption.SESSIONS
  );

  const thresholdEnvStatuses = useMemo(() => {
    return (
      thresholdStatuses?.filter(status => {
        return status.environment?.name === lastDeploy?.environment;
      }) || []
    );
  }, [thresholdStatuses, lastDeploy]);

  const healthyThresholdStatuses = thresholdEnvStatuses.filter(status => {
    return status.is_healthy;
  });

  const pendingThresholdStatuses = thresholdEnvStatuses.filter(status => {
    return new Date(status.end || '') > new Date();
  });

  const crashFreeRate = getHealthData.getCrashFreeRate(releaseVersion, id, activeDisplay);
  const get24hCountByProject = getHealthData.get24hCountByProject(id, activeDisplay);
  const timeSeries = getHealthData.getTimeSeries(releaseVersion, id, activeDisplay);
  const adoption = getHealthData.getAdoption(releaseVersion, id, activeDisplay);

  const adoptionStage =
    showReleaseAdoptionStages &&
    adoptionStages?.[project.slug] &&
    adoptionStages?.[project.slug].stage;

  const adoptionStageLabel =
    get24hCountByProject && adoptionStage && isMobileRelease(project.platform)
      ? ADOPTION_STAGE_LABELS[adoptionStage]
      : null;

  return (
    <ProjectRow data-test-id="release-card-project-row">
      <ReleaseProjectsLayout
        showReleaseAdoptionStages={showReleaseAdoptionStages}
        hasThresholds={hasThresholds}
      >
        <ReleaseProjectColumn>
          <ProjectBadge project={project} avatarSize={16} />
        </ReleaseProjectColumn>

        {showReleaseAdoptionStages && (
          <AdoptionStageColumn>
            {adoptionStageLabel ? (
              <Tooltip title={adoptionStageLabel.tooltipTitle} isHoverable>
                <Link
                  to={{
                    pathname: `/organizations/${organization.slug}/releases/`,
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

        {hasThresholds && (
          <DisplaySmallCol>
            {/* TODO: link to release details page */}
            {expectedThresholds > 0 && (
              <Tooltip
                title={
                  <div>
                    <div>
                      {pendingThresholdStatuses.length !== thresholdEnvStatuses.length &&
                        `${
                          healthyThresholdStatuses.length -
                          pendingThresholdStatuses.length
                        } / ${thresholdEnvStatuses.length} ` + t('thresholds succeeded')}
                    </div>
                    {pendingThresholdStatuses.length > 0 && (
                      <div>
                        {`${pendingThresholdStatuses.length} / ${thresholdEnvStatuses.length} ` +
                          t('still pending')}
                      </div>
                    )}
                    {thresholdEnvStatuses.length !== expectedThresholds && (
                      <div>{`... / ${expectedThresholds}`}</div>
                    )}
                    {t('Open in Release Details')}
                  </div>
                }
              >
                <ThresholdHealth
                  loading={thresholdEnvStatuses.length !== expectedThresholds}
                  allHealthy={
                    thresholdEnvStatuses.length === expectedThresholds &&
                    healthyThresholdStatuses.length === expectedThresholds
                  }
                  allThresholdsFinished={
                    pendingThresholdStatuses.length === 0 &&
                    thresholdEnvStatuses.length === expectedThresholds
                  }
                >
                  {thresholdEnvStatuses.length === expectedThresholds
                    ? healthyThresholdStatuses.length
                    : '...'}{' '}
                  / {expectedThresholds}
                </ThresholdHealth>
              </Tooltip>
            )}
          </DisplaySmallCol>
        )}

        <ViewColumn>
          <GuideAnchor disabled={!isTopRelease || index !== 0} target="view_release">
            <Button
              size="xs"
              to={{
                pathname: `/organizations/${
                  organization.slug
                }/releases/${encodeURIComponent(releaseVersion)}/`,
                query: {
                  ...extractSelectionParameters(location.query),
                  project: project.id,
                  yAxis: undefined,
                },
              }}
            >
              {t('View')}
            </Button>
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

const ThresholdHealth = styled('div')<{
  allHealthy?: boolean;
  allThresholdsFinished?: boolean;
  loading?: boolean;
}>`
  color: ${p => {
    if (!p.loading && !p.allHealthy) {
      return p.theme.errorText;
    }
    if (!p.loading && p.allThresholdsFinished) {
      return p.theme.successText;
    }
    return p.theme.activeText;
  }};
`;
