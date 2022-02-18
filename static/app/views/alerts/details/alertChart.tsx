import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import AreaChart from 'sentry/components/charts/areaChart';
import {HeaderTitleLegend, SectionHeading} from 'sentry/components/charts/styles';
import {Panel, PanelBody, PanelFooter} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {ReactEchartsRef} from 'sentry/types/echarts';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = WithRouterProps & {
  orgId: string;
  organization: Organization;
};

type State = {
  height: number;
  width: number;
};

class AlertChart extends React.PureComponent<Props, State> {
  state = {
    width: -1,
    height: -1,
  };

  ref: null | ReactEchartsRef = null;

  renderChartActions() {
    return (
      <ChartActions>
        <ChartFooter>
          <FooterHeader>{t('Alerts Triggered')}</FooterHeader>
          <FooterValue>{'88'}</FooterValue>
        </ChartFooter>
      </ChartActions>
    );
  }

  renderChart() {
    const TOTAL = 6;
    const NOW = new Date().getTime();
    const getValue = () => Math.round(Math.random() * 1000);
    const getDate = num => NOW - (TOTAL - num) * 86400000;
    const getData = num =>
      [...Array(num)].map((_v, i) => ({value: getValue(), name: getDate(i)}));

    return (
      <ChartPanel>
        <StyledPanelBody withPadding>
          <ChartHeader>
            <HeaderTitleLegend>{t('Alerts Triggered')}</HeaderTitleLegend>
          </ChartHeader>
          {getDynamicText({
            value: (
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
            ),
            fixed: <Placeholder height="200px" testId="skeleton-ui" />,
          })}
        </StyledPanelBody>
        {this.renderChartActions()}
      </ChartPanel>
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
    return this.renderChart();
  }
}

export default withRouter(AlertChart);

const ChartPanel = styled(Panel)`
  margin-top: ${space(2)};
`;

const ChartHeader = styled('div')`
  margin-bottom: ${space(3)};
`;

const ChartActions = styled(PanelFooter)`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: ${space(1)} 20px;
`;

const ChartFooter = styled('div')`
  display: flex;
  margin-right: auto;
`;

const FooterHeader = styled(SectionHeading)`
  flex: 1;
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
  margin: 0 ${space(2)};
`;

/* Override padding to make chart appear centered */
const StyledPanelBody = styled(PanelBody)`
  padding-right: 6px;
`;
