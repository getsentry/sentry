import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import moment from 'moment-timezone';
import isEqual from 'lodash/isEqual';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import Count from 'app/components/count';
import {use24Hours, getTimeFormat} from 'app/utils/dates';
import theme from 'app/utils/theme';
import {formatFloat} from 'app/utils/formatters';

type Point = {x: number; y: number[]; label?: string};
type Points = Point[];
type Series = Array<{
  data: Array<{x: number; y: number}>;
  label?: string;
  color?: string;
}>;
type Marker = {
  x: number;
  label?: string;
  fill?: string;
  offset?: number;
  className?: string;
};

type DefaultProps = {
  label: string;
  /**
   * @deprecated
   */
  points: Points;
  series: Series;
  markers: Marker[];
  barClasses: string[];
  /**
   * The amount of space between bars. Also represents an svg point
   */
  gap: number;
  className: string;
};

type Props = DefaultProps & {
  tooltip?: (point: Point, idx: number, context: StackedBarChart) => React.ReactNode;
  height?: React.CSSProperties['height'];
  width?: React.CSSProperties['width'];
  /**
   * Some bars need to be visible and interactable even if they are
   * empty. Use minHeights for that. Units are in svg points
   */
  minHeights?: number[];
  style?: React.CSSProperties;
};

type State = {
  series: Series;
  pointIndex: Record<number, Point>;
  interval: number | null;
};

class StackedBarChart extends React.Component<Props, State> {
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
    /* Some bars need to be visible and interactable even if they are
    empty. Use minHeights for that. Units are in svg points */
    minHeights: PropTypes.arrayOf(PropTypes.number),
    /* the amount of space between bars. Also represents an svg point */
    gap: PropTypes.number,
  };

  static defaultProps: DefaultProps = {
    label: '',
    points: [],
    series: [],
    markers: [],
    barClasses: ['chart-bar'],
    gap: 0.5,
    className: 'sparkline',
  };

  constructor(props: Props) {
    super(props);

    // massage points
    let series = props.series;

    if (props.points?.length) {
      if (series?.length) {
        throw new Error('Only one of [points|series] should be specified.');
      }

      series = this.pointsToSeries(props.points);
    }

    this.state = {
      series,
      pointIndex: this.pointIndex(series),
      interval: this.getInterval(series),
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
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

  shouldComponentUpdate(nextProps: Props) {
    return !isEqual(this.props, nextProps);
  }

  getInterval = (series: Series): number | null =>
    // TODO(dcramer): not guaranteed correct
    series.length && series[0].data.length > 1
      ? series[0].data[1].x - series[0].data[0].x
      : null;

  pointsToSeries = (points: Points): Series => {
    const series: Series = [];
    points.forEach((p, _pIdx) => {
      p.y.forEach((y, yIdx) => {
        if (!series[yIdx]) {
          series[yIdx] = {data: []};
        }
        series[yIdx].data.push({x: p.x, y});
      });
    });
    return series;
  };

  pointIndex = (series: Series): Record<number, Point> => {
    const points: Record<number, Point> = {};
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

  timeLabelAsHour(point: Point): React.ReactNode {
    const timeMoment = moment(point.x * 1000);
    const nextMoment = timeMoment.clone().add(59, 'minute');
    const timeFormat = getTimeFormat();

    return (
      <span>
        {timeMoment.format('LL')}
        <br />
        {timeMoment.format(timeFormat)}
        &#8594;
        {nextMoment.format(timeFormat)}
      </span>
    );
  }

  timeLabelAsDay(point: Point): React.ReactNode {
    const timeMoment = moment(point.x * 1000);

    return <span>{timeMoment.format('LL')}</span>;
  }

  timeLabelAsRange(interval: number, point: Point): React.ReactNode {
    const timeMoment = moment(point.x * 1000);
    const nextMoment = timeMoment.clone().add(interval - 1, 'second');
    const format = `MMM Do, ${getTimeFormat()}`;

    // e.g. Aug 23rd, 12:50 pm
    return (
      <span>
        {timeMoment.format(format)}
        &#8594
        {nextMoment.format(format)}
      </span>
    );
  }

  timeLabelAsFull(point: Point | Marker): string {
    const timeMoment = moment(point.x * 1000);
    const format = use24Hours() ? 'MMM D, YYYY HH:mm' : 'lll';
    return timeMoment.format(format);
  }

  getTimeLabel(point: Point): React.ReactNode {
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

  maxPointValue(): number {
    return Math.max(
      10,
      this.state.series
        .map(s => Math.max(...s.data.map(p => p.y)))
        .reduce((a, b) => a + b, 0)
    );
  }

  renderMarker(marker: Marker, index: number, pointWidth: number): React.ReactNode {
    const timeLabel = this.timeLabelAsFull(marker);
    const title = (
      <div style={{width: '130px'}}>
        {marker.label}
        <br />
        {timeLabel}
      </div>
    );

    // example key: m-last-seen-22811123, m-first-seen-228191
    const key = ['m', marker.className, marker.x].join('-');
    const markerOffset = marker.offset || 0;

    return (
      <CircleSvg
        key={key}
        left={index * pointWidth}
        offset={markerOffset || 0}
        viewBox="0 0 10 10"
        size={10}
      >
        <Tooltip title={title} position="bottom" disableForVisualTest>
          <circle
            data-test-id="chart-column"
            r="4"
            cx="50%"
            cy="50%"
            fill={marker.fill || theme.gray500}
            stroke="#fff"
            strokeWidth="2"
          >
            {marker.label}
          </circle>
        </Tooltip>
      </CircleSvg>
    );
  }

  renderTooltip = (point: Point, _pointIdx: number): React.ReactNode => {
    const timeLabel = this.getTimeLabel(point);
    const totalY = point.y.reduce((a, b) => a + b);
    return (
      <React.Fragment>
        <div style={{width: '130px'}}>
          <div className="time-label">{timeLabel}</div>
        </div>
        {this.props.label && (
          <div className="value-label">
            {totalY.toLocaleString()} {this.props.label}
          </div>
        )}
        {point.y.map((y, i) => {
          const s = this.state.series[i];
          if (s.label) {
            return (
              <div>
                <span style={{color: s.color}}>{s.label}:</span>{' '}
                {(y || 0).toLocaleString()}
              </div>
            );
          }
          return null;
        })}
      </React.Fragment>
    );
  };

  getMinHeight(index: number): number {
    const {minHeights} = this.props;
    return minHeights && (minHeights[index] || minHeights[index] === 0)
      ? minHeights[index]
      : 1;
  }

  renderChartColumn(
    point: Point,
    maxval: number,
    pointWidth: number,
    index: number,
    _totalPoints: number
  ): React.ReactNode {
    const totalY = point.y.reduce((a, b) => a + b);
    const totalPct = totalY / maxval;
    // we leave a little extra space for bars with min-heights.
    const maxPercentage = 99;

    let prevPct = 0;
    const pts = point.y.map((y, i) => {
      const pct = Math.max(
        totalY && formatFloat((y / totalY) * totalPct * maxPercentage, 2),
        this.getMinHeight(i)
      );

      const pt = (
        <rect
          key={i}
          x={index * pointWidth + '%'}
          y={100.0 - pct - prevPct + '%'}
          width={pointWidth - this.props.gap + '%'}
          data-test-id="chart-column"
          height={pct + '%'}
          fill={this.state.series[i].color}
          className={classNames(this.props.barClasses[i], 'barchart-rect')}
        >
          {y}
        </rect>
      );
      prevPct += pct;
      return pt;
    });

    const pointIdx = point.x;
    const tooltipFunc = this.props.tooltip || this.renderTooltip;

    return (
      <Tooltip
        title={tooltipFunc(this.state.pointIndex[pointIdx], pointIdx, this)}
        position="bottom"
        key={point.x}
      >
        <g>
          <rect
            x={index * pointWidth - this.props.gap + '%'}
            width={pointWidth + this.props.gap + '%'}
            height="100%"
            opacity="0"
          />
          {pts}
        </g>
      </Tooltip>
    );
  }

  renderChart() {
    const {pointIndex, series} = this.state;
    const totalPoints = Math.max(...series.map(s => s.data.length));
    // we expand the graph just a hair beyond 100% prevent a subtle white line on the edge
    const nudge = 0.1;
    const pointWidth = formatFloat((100.0 + this.props.gap + nudge) / totalPoints, 2);

    const maxval = this.maxPointValue();
    const markers = this.props.markers.slice();

    // group points, then resort
    const points = Object.keys(pointIndex)
      .map(k => {
        const p = pointIndex[k];
        return {x: p.x, y: p.y};
      })
      .sort((a, b) => a.x - b.x);

    markers.sort((a, b) => a.x - b.x);

    const children: React.ReactNode[] = [];
    const markerChildren: React.ReactNode[] = [];
    points.forEach((point, index) => {
      while (markers.length && markers[0].x <= point.x) {
        markerChildren.push(
          this.renderMarker(markers.shift() as Marker, index, pointWidth)
        );
      }

      children.push(
        this.renderChartColumn(point, maxval, pointWidth, index, totalPoints)
      );
    });

    // in bizarre case where markers never got rendered, render them last
    // NOTE: should this ever happen?
    markers.forEach(marker => {
      markerChildren.push(this.renderMarker(marker, points.length, pointWidth));
    });

    return (
      <SvgContainer>
        <StyledSvg viewBox="0 0 100 400" preserveAspectRatio="none" overflow="visible">
          {children}
        </StyledSvg>
        {markerChildren.length ? markerChildren : null}
      </SvgContainer>
    );
  }

  render() {
    const {className, style, height, width} = this.props;
    const figureClass = [className, 'barchart'].join(' ');
    const maxval = this.maxPointValue();

    return (
      <StyledFigure className={figureClass} style={{height, width, ...style}}>
        <span className="max-y">
          <Count value={maxval} />
        </span>
        <span className="min-y">0</span>
        {this.renderChart()}
      </StyledFigure>
    );
  }
}

const StyledSvg = styled('svg')`
  width: 100%;
  height: 100%;
  /* currently, min-heights are not calculated into maximum bar height, so
  we need the svg to allow elements to exceed the container. This overrides
  the global overflow: hidden declaration. Eventually, we should factor minimum
  bar heights into the overall chart height and remove this */
  overflow: visible !important;
`;

const StyledFigure = styled('figure')`
  display: block;
  position: relative;
`;

const SvgContainer = styled('div')`
  position: relative;
  width: 100%;
  height: 100%;
`;

const CircleSvg = styled('svg')<{size: number; offset: number; left: number}>`
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  position: absolute;
  bottom: -${p => p.size / 2}px;
  transform: translate(${p => (p.offset || 0) - p.size / 2}px, 0);
  left: ${p => p.left}%;

  &:hover circle {
    fill: ${p => p.theme.purple400};
  }
`;

export default StackedBarChart;
