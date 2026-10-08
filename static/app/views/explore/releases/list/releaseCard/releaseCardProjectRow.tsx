import LazyLoad from 'react-lazyload';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Count} from 'sentry/components/count';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {NotAvailable} from 'sentry/components/notAvailable';
import {extractSelectionParameters} from 'sentry/components/pageFilters/parse';
import {Placeholder} from 'sentry/components/placeholder';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconCheckmark, IconFire, IconWarning} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseProject} from 'sentry/types/release';
import {defined} from 'sentry/utils/defined';
import {ReleasesDisplayOption} from 'sentry/views/explore/releases/list/releasesDisplayOptions';
import type {ReleasesRequestRenderProps} from 'sentry/views/explore/releases/list/releasesRequest';
import {
  ADOPTION_STAGE_LABELS,
  displayCrashFreePercent,
  getReleaseNewIssuesUrl,
  getReleaseUnhandledIssuesUrl,
  isMobileRelease,
} from 'sentry/views/explore/releases/utils';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

const CRASH_FREE_DANGER_THRESHOLD = 98;
const CRASH_FREE_WARNING_THRESHOLD = 99.5;

const ADOPTION_CHART_TOOLTIP = {appendToBody: true};

function getCrashFreeIcon(crashFreePercent: number) {
  if (crashFreePercent < CRASH_FREE_DANGER_THRESHOLD) {
    return <IconFire variant="danger" size="sm" />;
  }

  if (crashFreePercent < CRASH_FREE_WARNING_THRESHOLD) {
    return <IconWarning variant="warning" size="sm" />;
  }

  return <IconCheckmark variant="success" size="sm" />;
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

export function ReleaseCardProjectRow({
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
    showReleaseAdoptionStages && adoptionStages?.[project.slug]?.stage;

  const adoptionStageLabel =
    get24hCountByProject && adoptionStage && isMobileRelease(project.platform)
      ? ADOPTION_STAGE_LABELS[adoptionStage]
      : null;

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Container minWidth="0">
          <ProjectBadge project={project} avatarSize={16} />
        </Container>
      </SimpleTable.RowCell>

      {showReleaseAdoptionStages && (
        <SimpleTable.RowCell>
          {adoptionStageLabel ? (
            <Tooltip title={adoptionStageLabel.tooltipTitle}>
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
                <Tag variant={adoptionStageLabel.variant}>{adoptionStageLabel.name}</Tag>
              </Link>
            </Tooltip>
          ) : (
            <NotAvailable />
          )}
        </SimpleTable.RowCell>
      )}

      <SimpleTable.RowCell>
        {showPlaceholders ? (
          <Placeholder width="100px" height="15px" />
        ) : (
          <Grid
            align="center"
            columns="30px minmax(0, 1fr)"
            flex="1"
            gap="md"
            minWidth="0"
          >
            <Text tabular>{adoption ? Math.round(adoption) : '0'}%</Text>
            <LazyLoad debounce={50} height={20}>
              <MiniBarChart
                series={timeSeries}
                height={20}
                isGroupedByDate
                showTimeInTooltip
                hideDelay={50}
                tooltip={ADOPTION_CHART_TOOLTIP}
                tooltipFormatter={(value: number) => {
                  const suffix =
                    activeDisplay === ReleasesDisplayOption.USERS
                      ? tn('user', 'users', value)
                      : tn('session', 'sessions', value);

                  return `${value.toLocaleString()} ${suffix}`;
                }}
                colors={[
                  theme.tokens.dataviz.semantic.accent,
                  theme.tokens.dataviz.semantic.other,
                ]}
              />
            </LazyLoad>
          </Grid>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        {showPlaceholders ? (
          <Placeholder width="60px" height="15px" />
        ) : defined(crashFreeRate) ? (
          <Flex align="center" gap="md">
            {getCrashFreeIcon(crashFreeRate)}
            <Text tabular>{displayCrashFreePercent(crashFreeRate)}</Text>
          </Flex>
        ) : (
          <NotAvailable />
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        {showPlaceholders ? (
          <Placeholder width="30px" height="15px" />
        ) : defined(crashCount) ? (
          <Tooltip title={t('Open in Issues')}>
            <Link
              to={{
                ...getReleaseUnhandledIssuesUrl(
                  organization.slug,
                  project.id,
                  releaseVersion
                ),
                query: {
                  ...extractSelectionParameters(location.query),
                  ...getReleaseUnhandledIssuesUrl(
                    organization.slug,
                    project.id,
                    releaseVersion
                  ).query,
                },
              }}
            >
              <Count value={crashCount} />
            </Link>
          </Tooltip>
        ) : (
          <NotAvailable />
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        <Tooltip title={t('Open in Issues')}>
          <Link
            to={{
              ...getReleaseNewIssuesUrl(organization.slug, project.id, releaseVersion),
              query: {
                ...extractSelectionParameters(location.query),
                ...getReleaseNewIssuesUrl(organization.slug, project.id, releaseVersion)
                  .query,
              },
            }}
          >
            <Count value={newGroups || 0} />
          </Link>
        </Tooltip>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end">
        <GuideAnchor disabled={!isTopRelease || index !== 0} target="view_release">
          <LinkButton
            size="xs"
            to={{
              pathname: makeReleasesPathname({
                organization,
                path: `/${encodeURIComponent(releaseVersion)}/`,
              }),
              query: {
                environment: location.query.environment,
                project: project.id,
                yAxis: undefined,
              },
            }}
          >
            {t('View')}
          </LinkButton>
        </GuideAnchor>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
