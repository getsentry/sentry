import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Box, Flex} from 'grid-emotion';

import {t} from 'app/locale';
import Link from 'app/components/link';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';

import {getChartData, getChartDataByDay, downloadAsCsv} from './utils';
import Table from './table';
import {Heading, ResultSummary, ChartWrapper, ChartNote} from '../styles';
import {NUMBER_OF_SERIES_BY_DAY} from '../data';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object,
  };

  constructor() {
    super();
    this.state = {
      view: 'table',
    };
  }

  componentWillReceiveProps(nextProps) {
    const {baseQuery, byDayQuery} = nextProps.data;

    if (!byDayQuery.data && ['line-by-day', 'bar-by-day'].includes(this.state.view)) {
      this.setState({
        view: 'table',
      });
    }

    if (
      !baseQuery.query.aggregations.length &&
      ['line', 'bar'].includes(this.state.view)
    ) {
      this.setState({
        view: 'table',
      });
    }
  }

  renderToggle() {
    const {baseQuery, byDayQuery} = this.props.data;

    const options = [{id: 'table', name: t('Table')}];

    if (baseQuery.query.aggregations.length) {
      options.push({id: 'line', name: t('Line')}, {id: 'bar', name: t('Bar')});
    }

    if (byDayQuery.data) {
      options.push(
        {id: 'line-by-day', name: t('Line by Day')},
        {id: 'bar-by-day', name: t('Bar by Day')}
      );
    }

    const linkClasses = 'btn btn-default btn-sm';

    return (
      <Flex justify="flex-end">
        <div className="btn-group">
          {options.map(opt => {
            const active = opt.id === this.state.view;
            return (
              <a
                key={opt.id}
                className={classNames('btn btn-default btn-sm', {active})}
                onClick={() => {
                  this.setState({view: opt.id});
                }}
              >
                {opt.name}
              </a>
            );
          })}
        </div>
        <Box ml={1}>
          <Link className={linkClasses} onClick={() => downloadAsCsv(baseQuery.data)}>
            {t('Export CSV')}
          </Link>
        </Box>
      </Flex>
    );
  }

  renderSummary() {
    const {baseQuery, byDayQuery} = this.props.data;
    const baseViews = ['table', 'line', 'bar'];
    const summaryData = baseViews.includes(this.state.view)
      ? baseQuery.data
      : byDayQuery.chartData;

    return (
      <ResultSummary>
        query time: {summaryData.timing.duration_ms} ms, {summaryData.data.length} rows
      </ResultSummary>
    );
  }

  renderNote() {
    return (
      <ChartNote>{t(`Displaying up to ${NUMBER_OF_SERIES_BY_DAY} results`)}</ChartNote>
    );
  }

  render() {
    const {baseQuery, byDayQuery} = this.props.data;
    const {view} = this.state;

    const basicChartData = getChartData(baseQuery.data.data, baseQuery.query);

    const byDayChartData =
      byDayQuery.data && getChartDataByDay(byDayQuery.data.data, byDayQuery.query);

    const legendData = byDayChartData
      ? {data: byDayChartData.map(entry => entry.seriesName)}
      : null;

    const tooltipOptions = {
      filter: value => value !== null,
      truncate: 80,
    };

    return (
      <Box flex="1">
        <Flex align="center" mb={space(2)}>
          <Box flex="1">
            <Heading>{t('Result')}</Heading>
          </Box>
          {this.renderToggle()}
        </Flex>

        {view === 'table' && <Table data={baseQuery.data} query={baseQuery.query} />}
        {view === 'line' && (
          <ChartWrapper>
            <LineChart
              series={basicChartData}
              height={300}
              tooltip={tooltipOptions}
              legend={{data: [baseQuery.aggregations[0][2]]}}
              renderer="canvas"
            />
          </ChartWrapper>
        )}
        {view === 'bar' && (
          <ChartWrapper>
            <BarChart
              series={basicChartData}
              height={300}
              tooltip={tooltipOptions}
              legend={{data: [baseQuery.aggregations[0][2]]}}
              renderer="canvas"
            />
          </ChartWrapper>
        )}
        {view === 'line-by-day' && (
          <ChartWrapper>
            <LineChart
              series={byDayChartData}
              height={300}
              tooltip={tooltipOptions}
              legend={legendData}
              renderer="canvas"
            />
            {this.renderNote()}
          </ChartWrapper>
        )}
        {view === 'bar-by-day' && (
          <ChartWrapper>
            <BarChart
              series={byDayChartData}
              stacked={true}
              height={300}
              tooltip={tooltipOptions}
              legend={legendData}
              renderer="canvas"
            />
            {this.renderNote()}
          </ChartWrapper>
        )}
        {this.renderSummary()}
      </Box>
    );
  }
}
