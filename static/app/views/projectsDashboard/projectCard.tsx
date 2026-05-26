import {Fragment} from 'react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {LinkButton} from '@sentry/scraps/button';
import {Grid, Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {IdBadge} from 'sentry/components/idBadge';
import {Panel} from 'sentry/components/panels/panel';
import {Placeholder} from 'sentry/components/placeholder';
import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
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
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CRASH_FREE_DECIMAL_THRESHOLD,
  displayCrashFreePercent,
} from 'sentry/views/explore/releases/utils';
import {
  getPerformanceBaseUrl,
  platformToDomainView,
} from 'sentry/views/performance/utils';
import {MissingReleasesButtons} from 'sentry/views/projectDetail/missingFeatureButtons/missingReleasesButtons';

import {Deploys} from './deploys';
import {ProjectChart} from './projectChart';
import {useProjectStats} from './useProjectStats';

interface ProjectCardProps {
  hasProjectAccess: boolean;
  project: Project;
}

export function ProjectCard({
  project: simpleProject,
  hasProjectAccess,
}: ProjectCardProps) {
  const organization = useOrganization();
  const hasPerformance = organization.features.includes('performance-view');
  const {getOne: getProjectStats} = useProjectStats({
    organization,
    hasPerformance,
  });

  const {stats, transactionStats, sessionStats, latestDeploys} =
    getProjectStats(simpleProject);
  const {slug} = simpleProject;
  const {hasHealthData, currentCrashFreeRate, previousCrashFreeRate} = sessionStats || {};

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
          platform={simpleProject.platform}
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

  const hasFirstEvent = !!simpleProject.firstEvent || simpleProject.firstTransactionEvent;
  const domainView = simpleProject
    ? platformToDomainView([simpleProject], [parseInt(simpleProject.id, 10)])
    : 'backend';

  return (
    <CardPanel data-test-id={slug}>
      <Container height="32px">
        <HeaderRow>
          <AlignedIdBadge
            project={simpleProject}
            avatarSize={32}
            hideOverflow
            disableLink={!hasProjectAccess}
          />
          <Grid flow="column" align="center" gap="xs">
            <SettingsButton
              variant="transparent"
              size="zero"
              icon={<IconSettings variant="muted" />}
              tooltipProps={{title: t('Settings')}}
              aria-label={t('Settings')}
              to={`/settings/${organization.slug}/projects/${slug}/`}
            />
            <BookmarkStar organization={organization} project={simpleProject} />
          </Grid>
        </HeaderRow>
        <SummaryLinks data-test-id="summary-links">
          {stats ? (
            <Fragment>
              <Link
                data-test-id="project-errors"
                to={`/organizations/${organization.slug}/issues/?project=${simpleProject.id}`}
              >
                {t('Errors: %s', formatAbbreviatedNumber(totalErrors))}
              </Link>
              {hasPerformance && (
                <TransactionsLink
                  data-test-id="project-transactions"
                  to={`${getPerformanceBaseUrl(organization.slug, domainView)}/?project=${simpleProject.id}`}
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
      </Container>
      <ChartContainer data-test-id="chart-container">
        {stats ? (
          <ProjectChart
            firstEvent={hasFirstEvent}
            stats={stats}
            transactionStats={transactionStats}
            project={simpleProject}
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
          {stats ? (
            <Deploys project={simpleProject} latestDeploys={latestDeploys} />
          ) : (
            <FooterPlaceholder />
          )}
        </div>
      </CardFooter>
    </CardPanel>
  );
}

const CardPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xl};
  height: 100%;
  padding: ${p => p.theme.space.xl};
  margin: 0;
`;

const CardFooter = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${p => p.theme.space.md};
`;

const ChartContainer = styled('div')`
  position: relative;
  margin: 0 -${p => p.theme.space.xl};
  background: ${p => p.theme.tokens.background.secondary};
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: 0 ${p => p.theme.space.xs};
  color: ${p => p.theme.tokens.content.primary};

  /* @TODO(jonasbadalic) This should be a title component and not a div */
  font-size: 1rem;
  font-weight: ${p => p.theme.font.weight.sans.medium};
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
  gap: ${p => p.theme.space.md};
  position: relative;
  top: -${p => p.theme.space.xl};
  font-weight: ${p => p.theme.font.weight.sans.regular};

  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};

  /* Need to offset for the project icon and margin */
  margin-left: 40px;

  a:not(:hover) {
    color: ${p => p.theme.tokens.content.secondary};
  }

  & > *:not(:last-child)::after {
    content: '|';
    position: relative;
    left: ${p => p.theme.space.xs};
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const SummaryLinkPlaceholder = styled(Placeholder)`
  height: 15px;
  width: 180px;
  margin-top: ${p => p.theme.space['2xs']};
  margin-bottom: ${p => p.theme.space.xs};
`;

const TransactionsLink = styled(Link)`
  display: flex;
  gap: ${p => p.theme.space.xs};
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
    font-size: ${p => p.theme.font.size.md};
    color: ${p => p.theme.tokens.content.secondary};
    margin-bottom: ${p => p.theme.space.xs};
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
    margin-top: ${p => p.theme.space.xs};
  }
`;

const SubHeading = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin-bottom: ${p => p.theme.space.xs};
`;

const FooterPlaceholder = styled(Placeholder)`
  height: 40px;
  width: auto;
  margin-right: ${p => p.theme.space.xl};
`;
