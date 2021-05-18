import * as React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import styled from '@emotion/styled';
import moment from 'moment';

import {Client} from 'app/api';
import ChartZoom from 'app/components/charts/chartZoom';
import StackedAreaChart from 'app/components/charts/stackedAreaChart';
import {
  HeaderTitleLegend,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {truncationFormatter} from 'app/components/charts/utils';
import Count from 'app/components/count';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project, Release} from 'app/types';
import {ReactEchartsRef} from 'app/types/echarts';
import withApi from 'app/utils/withApi';
import {DisplayOption} from 'app/views/releases/list/utils';
import {ReleaseHealthRequestRenderProps} from 'app/views/releases/utils/releaseHealthRequest';

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  releases: Release[];
  project: Project;
  getHealthData: ReleaseHealthRequestRenderProps['getHealthData'];
  activeDisplay: DisplayOption;
  showPlaceholders: boolean;
  totalCount: number;
};

type State = {
  width: number;
  height: number;
};

class ReleaseAdoptionChart extends React.PureComponent<Props, State> {
  state = {
    width: -1,
    height: -1,
  };

  ref: null | ReactEchartsRef = null;

  /**
   * Syncs component state with the chart's width/heights
   */
  updateDimensions = () => {
    const chartRef = this.ref?.getEchartsInstance?.();
    if (!chartRef) {
      return;
    }

    const width = chartRef.getWidth();
    const height = chartRef.getHeight();
    if (width !== this.state.width || height !== this.state.height) {
      this.setState({
        width,
        height,
      });
    }
  };

  handleRef = (ref: ReactEchartsRef): void => {
    if (ref && !this.ref) {
      this.ref = ref;
      this.updateDimensions();
    }

    if (!ref) {
      this.ref = null;
    }
  };

  renderEmpty() {
    return (
      <Panel>
        <PanelBody withPadding>
          <ChartHeader>
            <Placeholder height="24px" />
          </ChartHeader>
          <Placeholder height="200px" />
        </PanelBody>
        <ChartFooter>
          <Placeholder height="24px" />
        </ChartFooter>
      </Panel>
    );
  }

  render() {
    const {
      showPlaceholders,
      releases,
      project,
      activeDisplay,
      router,
      selection,
      getHealthData,
      totalCount,
    } = this.props;
    const {start, end, period, utc} = selection.datetime;

    if (showPlaceholders) {
      return this.renderEmpty();
    }

    const releasesSeries = releases.map(release => {
      const releaseVersion = release.version;

      const timeSeries = getHealthData.getTimeSeries(
        releaseVersion,
        Number(project.id),
        activeDisplay
      );

      const releaseData = timeSeries[0].data;
      const totalData = timeSeries[1].data;

      return {
        data: releaseData.map((d, i) => ({
          name: d.name,
          value:
            d.value > 0 && totalData[i].value > 0
              ? (100 * d.value) / totalData[i].value
              : 0,
        })),
        seriesName: releaseVersion,
      };
    });

    return (
      <Panel>
        <PanelBody withPadding>
          <ChartHeader>
            <ChartTitle>
              {activeDisplay === DisplayOption.USERS
                ? t('Users Adopted')
                : t('Sessions Adopted')}
            </ChartTitle>
          </ChartHeader>
          <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
            {zoomRenderProps => (
              <StackedAreaChart
                {...zoomRenderProps}
                grid={{
                  left: '10px',
                  right: '10px',
                  top: '40px',
                  bottom: '0px',
                }}
                series={releasesSeries}
                yAxis={{
                  min: 0,
                  max: 100,
                  type: 'value',
                  interval: 10,
                  splitNumber: 10,
                  data: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                  axisLabel: {
                    formatter: '{value}%',
                  },
                }}
                tooltip={{
                  formatter: seriesParams => {
                    const series = Array.isArray(seriesParams)
                      ? seriesParams
                      : [seriesParams];
                    const timestamp = series[0].data[0];
                    const topSeries = series
                      .sort((a, b) => b.data[1] - a.data[1])
                      .slice(0, 3);
                    const topSum = topSeries.reduce((acc, s) => acc + s.data[1], 0);
                    if (series.length - topSeries.length > 0) {
                      topSeries.push({
                        seriesName: t('%s Others', series.length - topSeries.length),
                        data: [timestamp, 100 - topSum],
                        marker:
                          '<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;"></span>',
                      });
                    }

                    return [
                      '<div class="tooltip-series">',
                      topSeries
                        .map(
                          s =>
                            `<div><span class="tooltip-label">${s.marker}<strong>${
                              s.seriesName && truncationFormatter(s.seriesName, 12)
                            }</strong></span>${s.data[1].toFixed(2)}%</div>`
                        )
                        .join(''),
                      '</div>',
                      `<div class="tooltip-date">${moment(timestamp).format(
                        'MMM D, YYYY LT'
                      )}</div>`,
                      `<div class="tooltip-arrow"></div>`,
                    ].join('');
                  },
                }}
              />
            )}
          </ChartZoom>
        </PanelBody>
        <ChartFooter>
          <InlineContainer>
            <SectionHeading>
              {tct('Total [display]', {
                display: activeDisplay === DisplayOption.USERS ? 'Users' : 'Sessions',
              })}
            </SectionHeading>
            <SectionValue>
              <Count value={totalCount ?? 0} />
            </SectionValue>
          </InlineContainer>
        </ChartFooter>
      </Panel>
    );
  }
}

export default withApi(withRouter(ReleaseAdoptionChart));

const ChartHeader = styled(HeaderTitleLegend)`
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('header')`
  display: flex;
  flex-direction: row;
`;

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${space(1)} 20px;
`;
