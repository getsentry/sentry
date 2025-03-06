import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import {LinkButton} from 'sentry/components/button';
import {BarChart} from 'sentry/components/charts/barChart';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {barAxisLabel, convertDayValueObjectToSeries, sortSeriesByDay} from './utils';

export type AlertsTriggered = Record<string, number>;

type AlertsTriggeredRule = MetricRule & {
  totalThisWeek: number;
  weeklyAvg: number;
};

interface TeamAlertsTriggeredProps extends DateTimeObject {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
}

function TeamAlertsTriggered({
  organization,
  projects,
  teamSlug,
  start,
  end,
  period,
  utc,
}: TeamAlertsTriggeredProps) {
  const datetime = {start, end, period, utc};

  const {
    data: alertsTriggered,
    isPending: isAlertsTriggeredLoading,
    isError: isAlertsTriggeredError,
    refetch: refetchAlertsTriggered,
  } = useApiQuery<AlertsTriggered>(
    [
      `/teams/${organization.slug}/${teamSlug}/alerts-triggered/`,
      {
        query: {
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 5000}
  );

  const {
    data: alertsTriggeredRules,
    isPending: isAlertsTriggeredRulesLoading,
    isError: isAlertsTriggeredRulesError,
    refetch: refetchAlertsTriggeredRule,
  } = useApiQuery<AlertsTriggeredRule[]>(
    [
      `/teams/${organization.slug}/${teamSlug}/alerts-triggered-index/`,
      {
        query: {
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
    {staleTime: 5000}
  );

  if (isAlertsTriggeredLoading || isAlertsTriggeredRulesLoading) {
    return (
      <ChartWrapper>
        <LoadingIndicator />
      </ChartWrapper>
    );
  }

  if (isAlertsTriggeredError || isAlertsTriggeredRulesError) {
    return (
      <LoadingError
        onRetry={() => {
          refetchAlertsTriggered();
          refetchAlertsTriggeredRule();
        }}
      />
    );
  }

  function renderTrend(rule: AlertsTriggeredRule) {
    const {weeklyAvg, totalThisWeek} = rule;
    const diff = totalThisWeek - weeklyAvg;

    // weeklyAvg can only be 0 only if totalThisWeek is also 0
    // but those should never be returned in alerts-triggered-index request
    if (weeklyAvg === 0) {
      return '\u2014';
    }

    return (
      <SubText color={diff <= 0 ? 'successText' : 'errorText'}>
        {formatPercentage(Math.abs(diff / weeklyAvg), 0)}
        <PaddedIconArrow direction={diff <= 0 ? 'down' : 'up'} size="xs" />
      </SubText>
    );
  }

  const seriesData = sortSeriesByDay(
    convertDayValueObjectToSeries(alertsTriggered ?? {})
  );

  return (
    <Fragment>
      <ChartWrapper>
        <BarChart
          style={{height: 190}}
          isGroupedByDate
          useShortDate
          period="7d"
          legend={{right: 0, top: 0}}
          yAxis={{minInterval: 1}}
          xAxis={barAxisLabel()}
          series={[
            {
              seriesName: t('Alerts Triggered'),
              data: seriesData,
              silent: true,
              barCategoryGap: '5%',
            },
          ]}
        />
      </ChartWrapper>
      <StyledPanelTable
        isEmpty={
          !alertsTriggered || !alertsTriggeredRules || alertsTriggeredRules?.length === 0
        }
        emptyMessage={t('No alerts triggered for team’s projects')}
        emptyAction={
          <ButtonsContainer>
            <LinkButton
              priority="primary"
              size="sm"
              to={makeAlertsPathname({
                path: `/rules/`,
                organization,
              })}
            >
              {t('Create Alert')}
            </LinkButton>
            <LinkButton
              size="sm"
              external
              href="https://docs.sentry.io/product/alerts/create-alerts/"
            >
              {t('Learn more')}
            </LinkButton>
          </ButtonsContainer>
        }
        headers={[
          t('Alert Rule'),
          t('Project'),
          <AlignRight key="last">{tct('Last [period] Average', {period})}</AlignRight>,
          <AlignRight key="curr">{t('This Week')}</AlignRight>,
          <AlignRight key="diff">{t('Difference')}</AlignRight>,
        ]}
      >
        {alertsTriggeredRules?.map(rule => {
          const project = projects.find(p => p.slug === rule.projects[0]);

          return (
            <Fragment key={rule.id}>
              <AlertNameContainer>
                <Link
                  to={makeAlertsPathname({
                    path: `/rules/details/${rule.id}/`,
                    organization,
                  })}
                >
                  {rule.name}
                </Link>
              </AlertNameContainer>
              <ProjectBadgeContainer>
                {project && <ProjectBadge avatarSize={18} project={project} />}
              </ProjectBadgeContainer>
              <AlignRight>{round(rule.weeklyAvg, 2)}</AlignRight>
              <AlignRight>{rule.totalThisWeek}</AlignRight>
              <AlignRight>{renderTrend(rule)}</AlignRight>
            </Fragment>
          );
        })}
      </StyledPanelTable>
    </Fragment>
  );
}

export default TeamAlertsTriggered;

const ChartWrapper = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr 0.5fr 0.2fr 0.2fr 0.2fr;
  font-size: ${p => p.theme.fontSizeMedium};
  white-space: nowrap;
  margin-bottom: 0;
  border: 0;
  box-shadow: unset;

  & > div {
    padding: ${space(1)} ${space(2)};
  }

  ${p =>
    p.isEmpty &&
    css`
      & > div:last-child {
        padding: 48px ${space(2)};
      }
    `}
`;

const AlertNameContainer = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;

const SubText = styled('div')<{color: ColorOrAlias}>`
  color: ${p => p.theme[p.color]};
`;

const ButtonsContainer = styled('div')`
  & > a {
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};
  }
`;
