import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import moment from 'moment-timezone';
import _ from 'lodash';

import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import ConfigStore from 'app/stores/configStore';

const StackedBarChart = createReactClass({
  displayName: 'StackedBarChart',

  propTypes: {
    // TODO(dcramer): DEPRECATED, use series instead
    points: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.number.isRequired,
        y: PropTypes.array.isRequired,
        label: PropTypes.string,
      })
    ),
    series: PropTypes.arrayOf(
      PropTypes.shape({
        data: PropTypes.arrayOf(
          PropTypes.shape({
            x: PropTypes.number.isRequired,
            y: PropTypes.number,
          })
        ),
        label: PropTypes.string,
      })
    ),
    height: PropTypes.number,
    width: PropTypes.number,
    label: PropTypes.string,
    markers: PropTypes.arrayOf(
      PropTypes.shape({
        x: PropTypes.number.isRequired,
        label: PropTypes.string,
      })
    ),
    tooltip: PropTypes.func,
    barClasses: PropTypes.array,
  },

  statics: {
    getInterval(series) {
      // TODO(dcramer): not guaranteed correct
      return series.length && series[0].data.length > 1
        ? series[0].data[1].x - series[0].data[0].x
        : null;
    },

    pointsToSeries(points) {
      let series = [];
      points.forEach((p, pIdx) => {
        p.y.forEach((y, yIdx) => {
          if (!series[yIdx]) {
            series[yIdx] = {data: []};
          }
          series[yIdx].data.push({x: p.x, y});
        });
      });
      return series;
    },

    pointIndex(series) {
      let points = {};
      series.forEach(s => {
        s.data.forEach(p => {
          if (!points[p.x]) {
            points[p.x] = {y: [], x: p.x};
          }
          points[p.x].y.push(p.y);
        });
      });
      return points;
    },
  },

  getDefaultProps() {
    return {
      className: 'sparkline',
      height: null,
      label: '',
      points: [],
      series: [],
      markers: [],
      width: null,
      barClasses: ['chart-bar'],
    };
  },

  getInitialState() {
    // massage points
    let series = this.props.series;
    if (this.props.points.length) {
      if (series.length) {
        throw new Error('Only one of [points|series] should be specified.');
      }

      series = StackedBarChart.pointsToSeries(this.props.points);
    }

    return {
      series,
      pointIndex: StackedBarChart.pointIndex(series),
      interval: StackedBarChart.getInterval(series),
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.points || nextProps.series) {
      let series = nextProps.series;
      if (nextProps.points.length) {
        if (series.length) {
          throw new Error('Only one of [points|series] should be specified.');
        }

        series = StackedBarChart.pointsToSeries(nextProps.points);
      }

      this.setState({
        series,
        pointIndex: StackedBarChart.pointIndex(series),
        interval: StackedBarChart.getInterval(series),
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(this.props, nextProps);
  },

  use24Hours() {
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    return options.clock24Hours;
  },

  floatFormat(number, places) {
    let multi = Math.pow(10, places);
    return parseInt(number * multi, 10) / multi;
  },

  timeLabelAsHour(point) {
    let timeMoment = moment(point.x * 1000);
    let nextMoment = timeMoment.clone().add(59, 'minute');
    let format = this.use24Hours() ? 'HH:mm' : 'LT';

    return (
      '<span>' +
      timeMoment.format('LL') +
      '<br />' +
      timeMoment.format(format) +
      '  &#8594; ' +
      nextMoment.format(format) +
      '</span>'
    );
  },

  timeLabelAsDay(point) {
    let timeMoment = moment(point.x * 1000);

    return `<span>${timeMoment.format('LL')}</span>`;
  },

  timeLabelAsRange(interval, point) {
    let timeMoment = moment(point.x * 1000);
    let nextMoment = timeMoment.clone().add(interval - 1, 'second');
    let format = this.use24Hours() ? 'MMM Do, HH:mm' : 'MMM Do, h:mm a';

    return (
      '<span>' +
      // e.g. Aug 23rd, 12:50 pm
      timeMoment.format(format) +
      ' &#8594 ' +
      nextMoment.format(format) +
      '</span>'
    );
  },

  timeLabelAsFull(point) {
    let timeMoment = moment(point.x * 1000);
    return timeMoment.format('lll');
  },

  getTimeLabel(point) {
    switch (this.state.interval) {
      case 3600:
        return this.timeLabelAsHour(point);
      case 86400:
        return this.timeLabelAsDay(point);
      case null:
        return this.timeLabelAsFull(point);
      default:
        return this.timeLabelAsRange(this.state.interval, point);
    }
  },

  maxPointValue() {
    return Math.max(
      10,
      this.state.series
        .map(s => Math.max(...s.data.map(p => p.y)))
        .reduce((a, b) => a + b, 0)
    );
  },

  renderMarker(marker) {
    let timeLabel = moment(marker.x * 1000).format('lll');
    let title =
      '<div style="width:130px">' + marker.label + '<br/>' + timeLabel + '</div>';
    let className = 'chart-marker ' + (marker.className || '');

    // example key: m-last-seen-22811123, m-first-seen-228191
    let key = ['m', marker.className, marker.x].join('-');

    return (
      <Tooltip title={title} key={key} tooltipOptions={{html: true, placement: 'bottom'}}>
        <a className={className} style={{height: '100%'}}>
          <span>{marker.label}</span>
        </a>
      </Tooltip>
    );
  },

  renderTooltip(point, pointIdx) {
    let timeLabel = this.getTimeLabel(point);
    let totalY = point.y.reduce((a, b) => a + b);
    let title =
      '<div style="width:130px">' +
      `<div class="time-label">${timeLabel}</div>` +
      '</div>';
    if (this.props.label) {
      title += `<div class="value-label">${totalY.toLocaleString()} ${this.props
        .label}</div>`;
    }
    point.y.forEach((y, i) => {
      let s = this.state.series[i];
      if (s.label) {
        title += `<div><span style="color:${s.color}">${s.label}:</span> ${(y || 0
        ).toLocaleString()}</div>`;
      }
    });
    return title;
  },

  renderChartColumn(point, maxval, pointWidth) {
    let totalY = point.y.reduce((a, b) => a + b);
    let totalPct = totalY / maxval;
    let prevPct = 0;
    let pts = point.y.map((y, i) => {
      let pct = totalY && this.floatFormat(y / totalY * totalPct * 99, 2);
      let pt = (
        <span
          key={i}
          className={this.props.barClasses[i]}
          style={{
            height: pct + '%',
            bottom: prevPct + '%',
            backgroundColor: this.state.series[i].color || null,
          }}
        >
          {y}
        </span>
      );
      prevPct += pct;
      return pt;
    });

    let pointIdx = point.x;
    let tooltipFunc = this.props.tooltip || this.renderTooltip;

    return (
      <Tooltip
        title={tooltipFunc(this.state.pointIndex[pointIdx], pointIdx, this)}
        key={point.x}
        tooltipOptions={{html: true, placement: 'bottom'}}
      >
        <a className="chart-column" style={{width: pointWidth, height: '100%'}}>
          {pts}
        </a>
      </Tooltip>
    );
  },

  renderChart() {
    let {pointIndex, series} = this.state;
    let totalPoints = Math.max(...series.map(s => s.data.length));
    let pointWidth = this.floatFormat(100.0 / totalPoints, 2) + '%';

    let maxval = this.maxPointValue();
    let markers = this.props.markers.slice();

    // group points, then resort
    let points = Object.keys(pointIndex)
      .map(k => {
        let p = pointIndex[k];
        return {x: p.x, y: p.y};
      })
      .sort((a, b) => {
        return a.x - b.x;
      });

    markers.sort((a, b) => {
      return a.x - b.x;
    });

    let children = [];
    points.forEach(point => {
      while (markers.length && markers[0].x <= point.x) {
        children.push(this.renderMarker(markers.shift()));
      }

      children.push(this.renderChartColumn(point, maxval, pointWidth));
    });

    // in bizarre case where markers never got rendered, render them last
    // NOTE: should this ever happen?
    markers.forEach(marker => {
      children.push(this.renderMarker(marker));
    });

    return children;
  },

  render() {
    let {className, style, height, width} = this.props;
    let figureClass = [className, 'barchart'].join(' ');
    let maxval = this.maxPointValue();

    return (
      <figure className={figureClass} style={{height, width, ...style}}>
        <span className="max-y">
          <Count value={maxval} />
        </span>
        <span className="min-y">0</span>
        <span>{this.renderChart()}</span>
      </figure>
    );
  },
});

export default StackedBarChart;
