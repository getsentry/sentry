import moment from 'moment';
import React from 'react';
import {valueIsEqual} from '../utils';
import TooltipMixin from '../mixins/tooltip';

const StackedBarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.array.isRequired,
      label: React.PropTypes.string
    })),
    interval: React.PropTypes.string,
    height: React.PropTypes.number,
    width: React.PropTypes.number,
    placement: React.PropTypes.string,
    label: React.PropTypes.string,
    markers: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    barClasses: React.PropTypes.array
  },

  mixins: [
    TooltipMixin(function () {
      let barChartInstance = this;
      return {
        html: true,
        placement: this.props.placement,
        selector: '.tip',
        viewport: this.props.viewport,

        // This callback is fired when the user hovers over the
        // barchart / triggers tooltip rendering. This is better
        // than using data-title, which renders up-front for each
        // StackedBarChart (slow).
        title: function (instance) {
          // `this` is the targeted element
          let pointIdx = this.getAttribute('data-point-index');

          if (pointIdx)
            return barChartInstance.renderTooltip(pointIdx);
          else
            return this.getAttribute('data-title');
        }
      };
    })
  ],

  statics: {
    getInterval(points) {
      return points.length > 1 ? points[1].x - points[0].x : null;
    }
  },

  getDefaultProps() {
    return {
      className: '',
      height: null,
      label: 'events',
      placement: 'bottom',
      points: [],
      markers: [],
      width: null,
      barClasses: ['chart-bar']
    };
  },

  getInitialState() {
    return {
      interval: StackedBarChart.getInterval(this.props.points)
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.points) {
      this.setState({
        interval: StackedBarChart.getInterval(nextProps.points)
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return !valueIsEqual(this.props, nextProps, true);
  },

  floatFormat(number, places) {
    let multi = Math.pow(10, places);
    return parseInt(number * multi, 10) / multi;
  },

  timeLabelAsHour(point) {
    let timeMoment = moment(point.x * 1000);
    let nextMoment = timeMoment.clone().add(59, 'minute');

    return (
      '<span>' +
        timeMoment.format('LL') + '<br />' +
        timeMoment.format('LT') + '  &#8594; ' + nextMoment.format('LT') +
      '</span>'
    );
  },

  timeLabelAsDay(point) {
    let timeMoment = moment(point.x * 1000);

    return (
      '<span>' +
        timeMoment.format('LL') +
      '</span>'
    );
  },

  timeLabelAsRange(interval, point) {
    let timeMoment = moment(point.x * 1000);
    let nextMoment = timeMoment.clone().add(interval - 1, 'second');

    return (
      '<span>' +
        // e.g. Aug 23rd, 12:50 pm
        timeMoment.format('MMM Do, h:mm a') +
        ' &#8594 ' + nextMoment.format('MMM Do, h:mm a') +
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
    let maxval = 10;
    this.props.points.forEach((point) => {
      let totalY = 0;
      point.y.forEach((y) => {
        totalY += y;
      });
      if (totalY > maxval) {
        maxval = totalY;
      }
    });
    return maxval;
  },

  renderMarker(marker) {
    let timeLabel = moment(marker.x * 1000).format('lll');
    let title = (
      '<div style="width:130px">' +
        marker.label + '<br/>' +
        timeLabel +
      '</div>'
    );
    let className = 'chart-marker tip ' + (marker.className || '');

    // example key: m-last-seen-22811123, m-first-seen-228191
    let key = ['m', marker.className, marker.x].join('-');

    return (
      <a key={key} className={className} data-title={title}>
        <span>{marker.label}</span>
      </a>
    );
  },

  renderTooltip(pointIdx) {
    let point = this.props.points[pointIdx];
    let timeLabel = this.getTimeLabel(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }
    let title = (
      '<div style="width:130px">' +
        totalY + ' ' + this.props.label + '<br/>' +
        timeLabel +
      '</div>'
    );
    if (point.label) {
      title += '<div>(' + point.label + ')</div>';
    }
    return title;
  },

  renderChartColumn(pointIdx, maxval, pointWidth) {
    let point = this.props.points[pointIdx];
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }
    let totalPct = totalY / maxval;
    let prevPct = 0;
    let pts = point.y.map((y, i) => {
        let pct = totalY && this.floatFormat((y / totalY) * totalPct * 99, 2);
        let pt = (
          <span key={i} className={this.props.barClasses[i]}
                style={{height: pct + '%', bottom: prevPct + '%'}}>{y}</span>
        );
        prevPct += pct;
        return pt;
     });
    return (
      <a key={point.x}
         className="chart-column tip"
         data-point-index={pointIdx}
         style={{width: pointWidth}}
       >
       {pts}
      </a>
    );
  },

  renderChart() {
    let points = this.props.points;
    let pointWidth = this.floatFormat(100.0 / points.length, 2) + '%';

    let maxval = this.maxPointValue();

    let markers = this.props.markers.slice();

    let children = [];
    points.forEach((point, pointIdx) => {
      while(markers.length && markers[0].x <= point.x) {
        children.push(this.renderMarker(markers.shift()));
      }

      children.push(this.renderChartColumn(pointIdx, maxval, pointWidth));
    });

    // in bizarre case where markers never got rendered, render them last
    // NOTE: should this ever happen?
    markers.forEach((marker) => {
      children.push(this.renderMarker(marker));
    });

    return children;
  },

  render() {
    let figureClass = [this.props.className, 'barchart'].join(' ');
    let maxval = this.maxPointValue();

    return (
      <figure className={figureClass} height={this.props.height} width={this.props.width}>
        <span className="max-y">{maxval}</span>
        <span className="min-y">0</span>
        <span>{this.renderChart()}</span>
      </figure>
    );
  }
});

export default StackedBarChart;
