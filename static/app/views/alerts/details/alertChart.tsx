import * as React from 'react';
import styled from '@emotion/styled';

import AreaChart from 'sentry/components/charts/areaChart';
import {HeaderTitleLegend, SectionHeading} from 'sentry/components/charts/styles';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  orgId: string;
  organization: Organization;
};

class AlertChart extends React.PureComponent<Props> {
  renderChart() {
    const TOTAL = 6;
    const NOW = new Date().getTime();
    const getValue = () => Math.round(Math.random() * 1000);
    const getDate = num => NOW - (TOTAL - num) * 86400000;
    const getData = num =>
      [...Array(num)].map((_v, i) => ({value: getValue(), name: getDate(i)}));

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
        series={[
          {
            seriesName: 'Alerts',
            data: getData(7),
          },
        ]}
      />
    );
  }

  renderEmpty() {
    return (
      <ChartPanel>
        <PanelBody withPadding>
          <Placeholder height="200px" />
        </PanelBody>
      </ChartPanel>
    );
  }

  render() {
    return (
      <ChartPanel>
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
          <FooterHeader>{t('Alerts Triggered')}</FooterHeader>
          <FooterValue>{'88'}</FooterValue>
        </ChartFooter>
      </ChartPanel>
    );
  }
}

export default AlertChart;

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

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
  font-size: ${p => p.theme.fontSizeSmall};
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
