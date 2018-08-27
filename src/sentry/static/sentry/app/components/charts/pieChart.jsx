import PropTypes from 'prop-types';
import React from 'react';

import Legend from './components/legend';
import PieSeries from './series/pieSeries';
import BaseChart from './baseChart';

class PieChart extends React.Component {
  static propTypes = {
    // We passthrough all props exception `options`
    ...BaseChart.propTypes,

    // Attempt to select first series in chart (to show in center of PieChart)
    selectOnRender: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.chart = React.createRef();
    this.isInitialSelected = true;
    this.selected = 0;
  }

  componentDidMount() {
    let {selectOnRender} = this.props;

    if (!selectOnRender) return;

    // Timeout is because we need to wait for rendering animation to complete
    // And I haven't found a callback for this
    setTimeout(() => this.highlight(0), 1000);
  }

  // echarts Legend does not have access to percentages (but tooltip does :/)
  getSeriesPercentages = series => {
    const total = series.data.reduce((acc, {value}) => acc + value, 0);
    return series.data
      .map(({name, value}) => [name, Math.round(value / total * 10000) / 100])
      .reduce(
        (acc, [name, value]) => ({
          ...acc,
          [name]: value,
        }),
        {}
      );
  };

  // Select a series to highlight (e.g. shows details of series)
  // This is the same event as when you hover over a series in the chart
  highlight = dataIndex => {
    if (!this.chart.current) return;

    this.chart.current.getEchartsInstance().dispatchAction({
      type: 'highlight',
      seriesIndex: 0,
      dataIndex,
    });
  };

  // Opposite of `highlight`
  downplay = dataIndex => {
    if (!this.chart.current) return;

    this.chart.current.getEchartsInstance().dispatchAction({
      type: 'downplay',
      seriesIndex: 0,
      dataIndex,
    });
  };

  render() {
    const {series, ...props} = this.props;
    if (!series || !series.length) return null;
    if (series.length > 1) {
      // eslint-disable-next-line no-console
      console.warn('PieChart only uses the first series!');
    }

    // Note, we only take the first series unit!
    const [firstSeries] = series;
    const seriesPercentages = this.getSeriesPercentages(firstSeries);

    return (
      <BaseChart
        ref={this.chart}
        onChartReady={this.handleChartReady}
        onEvents={{
          // when legend highlights it does NOT pass dataIndex :(
          highlight: ({name, ...args}) => {
            if (
              !this.isInitialSelected ||
              !name ||
              firstSeries.data[this.selected].name === name
            )
              return;

            // Unhighlight if not initial "highlight" event and
            // if name exists (i.e. not dispatched from cDM) and
            // highlighted series name is different than the initially selected series name
            this.downplay(this.selected);
            this.isInitialSelected = false;
          },

          mouseover: ({dataIndex, ...args}) => {
            if (!this.isInitialSelected) return;
            if (dataIndex === this.selected) return;
            this.downplay(this.selected);
            this.isInitialSelected = false;
          },
        }}
        {...props}
        options={{
          legend: Legend({
            orient: 'vertical',
            align: 'left',
            show: true,
            left: 10,
            top: 10,
            bottom: 10,
            formatter: name => {
              return `${name} ${typeof seriesPercentages[name] !== 'undefined'
                ? `(${seriesPercentages[name]}%)`
                : ''}`;
            },
          }),
          series: [
            PieSeries({
              name: firstSeries.seriesName,
              data: firstSeries.data,
              avoidLabelOverlap: false,
              label: {
                normal: {
                  formatter: ({name, percent, dataIndex, ...args}) => {
                    // Need newline here
                    return `${name}
                    ${percent}%`;
                  },
                  show: false,
                  position: 'center',
                },
                emphasis: {
                  show: true,
                  textStyle: {
                    fontSize: '18',
                  },
                },
              },
              itemStyle: {
                normal: {
                  label: {
                    show: false,
                  },
                  labelLine: {
                    show: false,
                  },
                },
              },
            }),
          ],
        }}
      />
    );
  }
}

export default PieChart;
