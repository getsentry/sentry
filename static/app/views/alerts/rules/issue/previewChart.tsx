import styled from '@emotion/styled';

import {AreaChart, AreaChartSeries} from 'sentry/components/charts/areaChart';
import {HeaderTitleLegend, SectionHeading} from 'sentry/components/charts/styles';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {ProjectAlertRuleStats} from 'sentry/types/alerts';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  ruleFireHistory: ProjectAlertRuleStats[];
};

const PreviewChart = ({ruleFireHistory}: Props) => {
  const renderChart = fireHistory => {
    const series: AreaChartSeries = {
      seriesName: 'Alerts Triggered',
      data: fireHistory.map(alert => ({
        name: alert.date,
        value: alert.count,
      })),
      emphasis: {
        disabled: true,
      },
    };

    return (
      <AreaChart
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
    );
  };

  const totalAlertsTriggered = ruleFireHistory.reduce((acc, curr) => acc + curr.count, 0);

  return (
    <Panel>
      <StyledPanelBody withPadding>
        <ChartHeader>
          <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
        </ChartHeader>
        {getDynamicText({
          value: renderChart(ruleFireHistory),
          fixed: <Placeholder height="200px" testId="skeleton-ui" />,
        })}
      </StyledPanelBody>
      <ChartFooter>
        <FooterHeader>{t('Total Alerts')}</FooterHeader>
        <FooterValue>{totalAlertsTriggered.toLocaleString()}</FooterValue>
      </ChartFooter>
    </Panel>
  );
};

export default PreviewChart;

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
  padding-right: ${space(0.75)};
`;
