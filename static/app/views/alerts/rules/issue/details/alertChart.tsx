import {WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import {AreaChart} from 'sentry/components/charts/areaChart';
import ChartZoom from 'sentry/components/charts/chartZoom';
import {HeaderTitleLegend, SectionHeading} from 'sentry/components/charts/styles';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {IssueAlertRule, ProjectAlertRuleStats} from 'sentry/types/alerts';
import getDynamicText from 'sentry/utils/getDynamicText';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

type Props = AsyncComponent['props'] &
  DateTimeObject &
  WithRouterProps & {
    organization: Organization;
    project: Project;
    rule: IssueAlertRule;
  };

type State = AsyncComponent['state'] & {
  ruleFireHistory: ProjectAlertRuleStats[] | null;
};

class AlertChart extends AsyncComponent<Props, State> {
  componentDidUpdate(prevProps: Props) {
    const {project, organization, start, end, period, utc} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc ||
      prevProps.organization.id !== organization.id ||
      prevProps.project.id !== project.id
    ) {
      this.remountComponent();
    }
  }

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      ruleFireHistory: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization, period, start, end, utc, rule} = this.props;

    return [
      [
        'ruleFireHistory',
        `/projects/${organization.slug}/${project.slug}/rules/${rule.id}/stats/`,
        {
          query: {
            ...(period && {statsPeriod: period}),
            start,
            end,
            utc,
          },
        },
      ],
    ];
  }

  renderChart() {
    const {router, period, start, end, utc} = this.props;
    const {ruleFireHistory} = this.state;

    const series = {
      seriesName: 'Alerts Triggered',
      data:
        ruleFireHistory?.map(alert => ({
          name: alert.date,
          value: alert.count,
        })) ?? [],
      emphasis: {
        disabled: true,
      },
    };

    return (
      <ChartZoom
        router={router}
        period={period}
        start={start}
        end={end}
        utc={utc}
        usePageDate
      >
        {zoomRenderProps => (
          <AreaChart
            {...zoomRenderProps}
            isGroupedByDate
            showTimeInTooltip
            grid={{
              left: space(0.25),
              right: space(2),
              top: space(3),
              bottom: 0,
            }}
            yAxis={{
              minInterval: 1,
            }}
            series={[series]}
          />
        )}
      </ChartZoom>
    );
  }

  renderEmpty() {
    return (
      <Panel>
        <PanelBody withPadding>
          <Placeholder height="200px" />
        </PanelBody>
      </Panel>
    );
  }

  render() {
    const {ruleFireHistory, loading} = this.state;

    const totalAlertsTriggered =
      ruleFireHistory?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;

    return loading ? (
      this.renderEmpty()
    ) : (
      <Panel>
        <StyledPanelBody withPadding>
          <ChartHeader>
            <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
          </ChartHeader>
          {getDynamicText({
            value: this.renderChart(),
            fixed: <Placeholder height="200px" testId="skeleton-ui" />,
          })}
        </StyledPanelBody>
        <ChartFooter>
          <FooterHeader>{t('Total Alerts')}</FooterHeader>
          <FooterValue>{totalAlertsTriggered.toLocaleString()}</FooterValue>
        </ChartFooter>
      </Panel>
    );
  }
}

export default withSentryRouter(AlertChart);

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${space(1)} 20px;
`;

const FooterHeader = styled(SectionHeading)`
  display: flex;
  align-items: center;
  margin: 0;
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;

const FooterValue = styled('div')`
  display: flex;
  align-items: center;
  margin: 0 ${space(1)};
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;
