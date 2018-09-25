import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment-timezone';
import _ from 'lodash';
import styled from 'react-emotion';
import cx from 'classnames';

import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import ConfigStore from 'app/stores/configStore';
import theme from 'app/utils/theme';

class StackedBarChart extends React.Component {
  static propTypes = {
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
    minHeights: PropTypes.arrayOf(PropTypes.number),
    gap: PropTypes.number,
  };

  static defaultProps = {
    className: 'sparkline',
    height: null,
    label: '',
    points: [],
    series: [],
    markers: [],
    width: null,
    barClasses: ['chart-bar'],
    gap: 2,
  };

  constructor(props) {
    super(props);

    // massage points
    let series = this.props.series;

    if (this.props.points.length) {
      if (series.length) {
        throw new Error('Only one of [points|series] should be specified.');
      }

      series = this.pointsToSeries(this.props.points);
    }

    this.state = {
      series,
      pointIndex: this.pointIndex(series),
      interval: this.getInterval(series),
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.points || nextProps.series) {
      let series = nextProps.series;
      if (nextProps.points.length) {
        if (series.length) {
          throw new Error('Only one of [points|series] should be specified.');
        }

        series = this.pointsToSeries(nextProps.points);
      }

      this.setState({
        series,
        pointIndex: this.pointIndex(series),
        interval: this.getInterval(series),
      });
    }
  }

  shouldComponentUpdate(nextProps, nextState) {
    return !_.isEqual(this.props, nextProps);
  }

  getInterval = series => {
    // TODO(dcramer): not guaranteed correct
    return series.length && series[0].data.length > 1
      ? series[0].data[1].x - series[0].data[0].x
      : null;
  };

  pointsToSeries = points => {
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
  };

  pointIndex = series => {
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
  };

  use24Hours() {
    let user = ConfigStore.get('user');
    let options = user ? user.options : {};
    return options.clock24Hours;
  }

  floatFormat(number, places) {
    let multi = Math.pow(10, places);
    return parseInt(number * multi, 10) / multi;
  }

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
  }

  timeLabelAsDay(point) {
    let timeMoment = moment(point.x * 1000);

    return `<span>${timeMoment.format('LL')}</span>`;
  }

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
  }

  timeLabelAsFull(point) {
    let timeMoment = moment(point.x * 1000);
    return timeMoment.format('lll');
  }

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
  }

  maxPointValue() {
    return Math.max(
      10,
      this.state.series
        .map(s => Math.max(...s.data.map(p => p.y)))
        .reduce((a, b) => a + b, 0)
    );
  }

  renderMarker(marker, index, pointWidth) {
    let timeLabel = moment(marker.x * 1000).format('lll');
    let title =
      '<div style="width:130px">' + marker.label + '<br/>' + timeLabel + '</div>';

    // example key: m-last-seen-22811123, m-first-seen-228191
    let key = ['m', marker.className, marker.x].join('-');
    let markerOffset = marker.offset || 0;

    return (
      <Tooltip
        title={title}
        key={key}
        tooltipOptions={{html: true, placement: 'bottom', container: 'body'}}
      >
        <circle
          data-test-id="chart-column"
          cx={index * pointWidth + '%'}
          transform={`translate(${markerOffset || 0}, 0)`}
          cy="100%"
          r="4"
          fill={marker.fill || theme.gray2}
          stroke="#fff"
          strokeWidth={2}
        >
          {marker.label}
        </circle>
      </Tooltip>
    );
  }

  renderTooltip = (point, pointIdx) => {
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
  };

  getMinHeight(index, pointLength) {
    let {minHeights} = this.props;
    return minHeights && (minHeights[index] || minHeights[index] == 0)
      ? this.props.minHeights[index]
      : 1;
  }

  renderChartColumn(point, maxval, pointWidth, index, totalPoints) {
    let totalY = point.y.reduce((a, b) => a + b);
    let totalPct = totalY / maxval;
    let prevPct = 0;
    let pts = point.y.map((y, i) => {
      let pct = Math.max(
        totalY && this.floatFormat(y / totalY * totalPct * 99, 2),
        this.getMinHeight(i, point.y.length)
      );

      let pt = (
        <rect
          key={i}
          x={index * pointWidth + '%'}
          y={100.0 - pct - prevPct + '%'}
          width={pointWidth + '%'}
          height={pct + '%'}
          fill={this.state.series[i].color}
          className={cx(this.props.barClasses[i], 'barchart-rect')}
        >
          {y}
        </rect>
      );
      prevPct += pct;
      return pt;
    });

    let pointIdx = point.x;
    let tooltipFunc = this.props.tooltip || this.renderTooltip;
    let maskId = `path-${pointWidth}-${index}`; /* an ID in SVG is global just like html. */

    return (
      <Tooltip
        title={tooltipFunc(this.state.pointIndex[pointIdx], pointIdx, this)}
        tooltipOptions={{html: true, placement: 'bottom', container: 'body'}}
        key={point.x}
      >
        <g>
          <clipPath id={maskId}>
            <rect
              x={index * pointWidth + '%'}
              width={pointWidth + '%'}
              height="100%"
              transform={`translate(-${this.props.gap}, 0)`}
            />
          </clipPath>
          <g data-test-id="chart-column" clipPath={`url(#${maskId})`}>
            {pts}
          </g>
        </g>
      </Tooltip>
    );
  }

  renderChart() {
    let {pointIndex, series} = this.state;
    let totalPoints = Math.max(...series.map(s => s.data.length));
    let pointWidth = this.floatFormat(100.0 / totalPoints, 2);

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
    let markerChildren = [];
    points.forEach((point, index) => {
      while (markers.length && markers[0].x <= point.x) {
        markerChildren.push(this.renderMarker(markers.shift(), index, pointWidth));
      }

      children.push(
        this.renderChartColumn(point, maxval, pointWidth, index, totalPoints)
      );
    });

    // in bizarre case where markers never got rendered, render them last
    // NOTE: should this ever happen?
    markers.forEach(marker => {
      markerChildren.push(this.renderMarker(marker));
    });

    return (
      <React.Fragment>
        <StyledSvg gap={this.props.gap} overflow="visible">
          {children}
          {markerChildren.length ? markerChildren : null}
        </StyledSvg>
      </React.Fragment>
    );
  }

  render() {
    let {className, style, height, width} = this.props;
    let figureClass = [className, 'barchart'].join(' ');
    let maxval = this.maxPointValue();

    return (
      <SvgContainer className={figureClass} style={{height, width, ...style}}>
        <span className="max-y">
          <Count value={maxval} />
        </span>
        <span className="min-y">0</span>
        {this.renderChart()}
      </SvgContainer>
    );
  }
}

const StyledSvg = styled('svg')`
  width: calc(100% + ${p => p.gap}px);
  height: 100%;
  overflow: visible !important; /* overrides global declaration */
`;

const SvgContainer = styled('figure')`
  display: block;
  position: relative;
  width: 100%;
  height: 100%;
`;

export default StackedBarChart;
