import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import round from 'lodash/round';

import AsyncComponent from 'sentry/components/asyncComponent';
import Button from 'sentry/components/button';
import BarChart from 'sentry/components/charts/barChart';
import {DateTimeObject} from 'sentry/components/charts/utils';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import PanelTable from 'sentry/components/panels/panelTable';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {formatPercentage} from 'sentry/utils/formatters';
import {Color} from 'sentry/utils/theme';
import {IncidentRule} from 'sentry/views/alerts/incidentRules/types';

import {ProjectBadge, ProjectBadgeContainer} from './styles';
import {barAxisLabel, convertDayValueObjectToSeries, sortSeriesByDay} from './utils';

type AlertsTriggered = Record<string, number>;

type AlertsTriggeredRule = IncidentRule & {
  totalThisWeek: number;
  weeklyAvg: number;
};

type Props = AsyncComponent['props'] & {
  organization: Organization;
  projects: Project[];
  teamSlug: string;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  alertsTriggered: AlertsTriggered | null;
  alertsTriggeredRules: AlertsTriggeredRule[] | null;
};

class TeamAlertsTriggered extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      alertsTriggered: null,
      alertsTriggeredRules: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, start, end, period, utc, teamSlug} = this.props;
    const datetime = {start, end, period, utc};

    return [
      [
        'alertsTriggered',
        `/teams/${organization.slug}/${teamSlug}/alerts-triggered/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
      [
        'alertsTriggeredRules',
        `/teams/${organization.slug}/${teamSlug}/alerts-triggered-index/`,
        {
          query: {
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
    ];
  }

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc, teamSlug} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.teamSlug !== teamSlug
    ) {
      this.remountComponent();
    }
  }

  renderTrend(rule: AlertsTriggeredRule) {
    const {weeklyAvg, totalThisWeek} = rule;
    const diff = totalThisWeek - weeklyAvg;

    // weeklyAvg can only be 0 only if totalThisWeek is also 0
    // but those should never be returned in alerts-triggered-index request
    if (weeklyAvg === 0) {
      return '\u2014';
    }

    return (
      <SubText color={diff <= 0 ? 'green300' : 'red300'}>
        {formatPercentage(Math.abs(diff / weeklyAvg), 0)}
        <PaddedIconArrow direction={diff <= 0 ? 'down' : 'up'} size="xs" />
      </SubText>
    );
  }

  renderLoading() {
    return (
      <ChartWrapper>
        <LoadingIndicator />
      </ChartWrapper>
    );
  }

  renderBody() {
    const {organization, period, projects} = this.props;
    const {alertsTriggered, alertsTriggeredRules} = this.state;
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
            xAxis={barAxisLabel(seriesData.length)}
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
            !alertsTriggered || !alertsTriggeredRules || alertsTriggeredRules.length === 0
          }
          emptyMessage={t('No alerts triggered for this team’s projects')}
          emptyAction={
            <ButtonsContainer>
              <Button
                priority="primary"
                size="small"
                to={`/organizations/${organization.slug}/alerts/rules/`}
              >
                {t('Create Alert')}
              </Button>
              <Button
                size="small"
                external
                to="https://docs.sentry.io/product/alerts/create-alerts/"
              >
                {t('Learn more')}
              </Button>
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
                    to={`/organizations/${organization.slug}/alerts/rules/details/${rule.id}/`}
                  >
                    {rule.name}
                  </Link>
                </AlertNameContainer>
                <ProjectBadgeContainer>
                  {project && <ProjectBadge avatarSize={18} project={project} />}
                </ProjectBadgeContainer>
                <AlignRight>{round(rule.weeklyAvg, 2)}</AlignRight>
                <AlignRight>{rule.totalThisWeek}</AlignRight>
                <AlignRight>{this.renderTrend(rule)}</AlignRight>
              </Fragment>
            );
          })}
        </StyledPanelTable>
      </Fragment>
    );
  }
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
  ${overflowEllipsis}
`;

const AlignRight = styled('div')`
  text-align: right;
  font-variant-numeric: tabular-nums;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;

const SubText = styled('div')<{color: Color}>`
  color: ${p => p.theme[p.color]};
`;

const ButtonsContainer = styled('div')`
  & > a {
    margin-right: ${space(0.5)};
    margin-left: ${space(0.5)};
  }
`;
