import React from 'react';
import isEqual from 'lodash/isEqual';

import LineChart from 'app/components/charts/lineChart';

// TODO(releasesV2): type
type Props = {
  reloading: boolean;
  utc: boolean;
  releaseSeries: any;
  timeseriesData: any;
  // zoomRenderProps: any;
};

class ReleaseChart extends React.Component<Props> {
  shouldComponentUpdate(nextProps: Props) {
    if (nextProps.reloading || !nextProps.timeseriesData) {
      return false;
    }

    if (
      isEqual(this.props.timeseriesData, nextProps.timeseriesData) &&
      isEqual(this.props.releaseSeries, nextProps.releaseSeries)
    ) {
      return false;
    }

    return true;
  }

  render() {
    const {utc, releaseSeries, timeseriesData} = this.props;

    const legend = {
      right: 16,
      top: 16,
      selectedMode: false,
      icon: 'circle',
      itemHeight: 8,
      itemWidth: 8,
      itemGap: 12,
      align: 'left',
      textStyle: {
        verticalAlign: 'top',
        fontSize: 11,
        fontFamily: 'Rubik',
      },
      data: timeseriesData.map(d => d.seriesName),
    };

    return (
      <LineChart
        legend={legend}
        utc={utc}
        // {zoomRenderProps}
        series={[...timeseriesData, ...releaseSeries]}
        isGroupedByDate
        seriesOptions={{
          showSymbol: false,
        }}
        grid={{
          left: '24px',
          right: '24px',
          top: '32px',
          bottom: '12px',
        }}
      />
    );
  }
}

export default ReleaseChart;
