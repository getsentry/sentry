import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {loadStatsForProject} from 'sentry/actionCreators/projects';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Link} from 'sentry/components/core/link';
import IdBadge from 'sentry/components/idBadge';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import BookmarkStar from 'sentry/components/projects/bookmarkStar';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {
  Score,
  ScoreCard,
  ScorePanel,
  ScoreWrapper,
  Title,
  Trend,
} from 'sentry/components/scoreCard';
import {IconArrow, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStatsStore from 'sentry/stores/projectsStatsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';
import MissingReleasesButtons from 'sentry/views/projectDetail/missingFeatureButtons/missingReleasesButtons';
import {
  CRASH_FREE_DECIMAL_THRESHOLD,
  displayCrashFreePercent,
} from 'sentry/views/releases/utils';

import {Deploys} from './deploys';
import {ProjectChart} from './projectChart';

interface ProjectCardProps {
  hasProjectAccess: boolean;
  project: Project;
}

function ProjectCard({project: simpleProject, hasProjectAccess}: ProjectCardProps) {
  const api = useApi();
  const organization = useOrganization();

  const statsProject = useLegacyStore(ProjectsStatsStore)[simpleProject.slug];
  const project = statsProject ?? simpleProject;

  const {stats, slug, transactionStats, sessionStats} = project;
  const {hasHealthData, currentCrashFreeRate, previousCrashFreeRate} = sessionStats || {};

  const hasPerformance = organization.features.includes('performance-view');

  useEffect(() => {
    loadStatsForProject(api, project.id, {
      orgId: organization.slug,
      projectId: project.id,
      query: {
        transactionStats: hasPerformance ? '1' : undefined,
        dataset: DiscoverDatasets.METRICS_ENHANCED,
        sessionStats: '1',
      },
    });
  }, [project, organization.slug, hasPerformance, api]);

  const crashFreeTrend =
    defined(currentCrashFreeRate) && defined(previousCrashFreeRate)
      ? round(
          currentCrashFreeRate - previousCrashFreeRate,
          currentCrashFreeRate > CRASH_FREE_DECIMAL_THRESHOLD ? 3 : 0
        )
      : undefined;

  const missingFeatureCard = (
    <ScoreCard
      title={t('Crash Free Sessions')}
      score={
        <MissingReleasesButtons
          organization={organization}
          health
          platform={project.platform}
        />
      }
    />
  );

  const trendCard =
    defined(currentCrashFreeRate) && defined(crashFreeTrend) ? (
      <div>
        {crashFreeTrend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(crashFreeTrend))}\u0025`}
      </div>
    ) : undefined;

  const totalErrors = stats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;
  const totalTransactions =
    transactionStats?.reduce((sum, [_, value]) => sum + value, 0) ?? 0;

  const hasFirstEvent = !!project.firstEvent || project.firstTransactionEvent;
  const domainView = project
    ? platformToDomainView([project], [parseInt(project.id, 10)])
    : 'backend';

  return (
    <CardPanel data-test-id={slug}>
      <CardHeader>
        <HeaderRow>
          <AlignedIdBadge
            project={project}
            avatarSize={32}
            hideOverflow
            disableLink={!hasProjectAccess}
          />
          <ButtonBar gap="xs">
            <SettingsButton
              borderless
              size="zero"
              icon={<IconSettings variant="muted" />}
              title={t('Settings')}
              aria-label={t('Settings')}
              to={`/settings/${organization.slug}/projects/${slug}/`}
            />
            <BookmarkStar organization={organization} project={project} />
          </ButtonBar>
        </HeaderRow>
        <SummaryLinks data-test-id="summary-links">
          {stats ? (
            <Fragment>
              <Link
                data-test-id="project-errors"
                to={`/organizations/${organization.slug}/issues/?project=${project.id}`}
              >
                {t('Errors: %s', formatAbbreviatedNumber(totalErrors))}
              </Link>
              {hasPerformance && (
                <TransactionsLink
                  data-test-id="project-transactions"
                  to={`${getPerformanceBaseUrl(organization.slug, domainView)}/?project=${project.id}`}
                >
                  {t('Transactions: %s', formatAbbreviatedNumber(totalTransactions))}
                  {totalTransactions === 0 && (
                    <QuestionTooltip
                      title={t('Click here to learn more about performance monitoring')}
                      position="top"
                      size="xs"
                    />
                  )}
                </TransactionsLink>
              )}
            </Fragment>
          ) : (
            <SummaryLinkPlaceholder />
          )}
        </SummaryLinks>
      </CardHeader>
      <ChartContainer data-test-id="chart-container">
        {stats ? (
          <ProjectChart
            firstEvent={hasFirstEvent}
            stats={stats}
            transactionStats={transactionStats}
            project={project}
          />
        ) : (
          <Placeholder height="150px" />
        )}
      </ChartContainer>
      <CardFooter>
        <ScoreCardWrapper>
          {stats ? (
            hasHealthData ? (
              <ScoreCard
                title={t('Crash Free Sessions')}
                score={
                  defined(currentCrashFreeRate)
                    ? displayCrashFreePercent(currentCrashFreeRate)
                    : '\u2014'
                }
                trend={trendCard}
                trendStatus={
                  crashFreeTrend ? (crashFreeTrend > 0 ? 'good' : 'bad') : undefined
                }
              />
            ) : (
              missingFeatureCard
            )
          ) : (
            <Fragment>
              <SubHeading>{t('Crash Free Sessions')}</SubHeading>
              <FooterPlaceholder />
            </Fragment>
          )}
        </ScoreCardWrapper>
        <div>
          <SubHeading>{t('Latest Deploys')}</SubHeading>
          {stats ? <Deploys project={project} /> : <FooterPlaceholder />}
        </div>
      </CardFooter>
    </CardPanel>
  );
}

const CardPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  height: 100%;
  padding: ${space(2)};
  margin: 0;
`;

const CardHeader = styled('div')`
  height: 32px;
`;

const CardFooter = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(1)};
`;

const ChartContainer = styled('div')`
  position: relative;
  margin: 0 -${space(2)};
  background: ${p => p.theme.backgroundSecondary};
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: 0 ${space(0.5)};
  color: ${p => p.theme.tokens.content.primary};

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1.2;
`;

const AlignedIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
  & div {
    align-items: flex-start;
  }

  & span {
    padding: 0;
    position: relative;
    top: -1px;
  }
`;

const SummaryLinks = styled('div')`
  display: inline-flex;
  gap: ${space(1)};
  position: relative;
  top: -${space(2)};
  font-weight: ${p => p.theme.fontWeight.normal};

  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};

  /* Need to offset for the project icon and margin */
  margin-left: 40px;

  a:not(:hover) {
    color: ${p => p.theme.tokens.content.secondary};
  }

  & > *:not(:last-child)::after {
    content: '|';
    position: relative;
    left: ${space(0.5)};
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const SummaryLinkPlaceholder = styled(Placeholder)`
  height: 15px;
  width: 180px;
  margin-top: ${space(0.25)};
  margin-bottom: ${space(0.5)};
`;

const TransactionsLink = styled(Link)`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const SettingsButton = styled(LinkButton)`
  border-radius: 50%;
`;

const ScoreCardWrapper = styled('div')`
  ${ScorePanel} {
    min-height: auto;
    border: none;
    padding: 0;
    margin: 0;
  }
  ${Title} {
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.tokens.content.secondary};
    margin-bottom: ${space(0.5)};
  }
  ${ScoreWrapper} {
    flex-direction: column;
    align-items: flex-start;
  }
  ${Score} {
    font-size: 28px;
  }
  ${Trend} {
    margin-left: 0;
    margin-top: ${space(0.5)};
  }
`;

const SubHeading = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(0.5)};
`;

const FooterPlaceholder = styled(Placeholder)`
  height: 40px;
  width: auto;
  margin-right: ${space(2)};
`;

export default ProjectCard;
