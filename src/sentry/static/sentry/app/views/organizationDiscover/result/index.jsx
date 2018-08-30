import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';

import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import Tooltip from 'app/components/charts/components/tooltip';

import Table from './table';
import {getChartData, getChartDataByDay, formatTooltip} from './utils';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object,
    query: PropTypes.object,
    chartData: PropTypes.object,
    chartQuery: PropTypes.object,
  };

  constructor() {
    super();
    this.state = {
      view: 'table',
    };
  }

  componentWillReceiveProps(nextProps) {
    if (!nextProps.chartData && ['line-by-day', 'bar-by-day'].includes(this.state.view)) {
      this.setState({
        view: 'table',
      });
    }

    if (
      !nextProps.query.aggregations.length &&
      ['line', 'bar'].includes(this.state.view)
    ) {
      this.setState({
        view: 'table',
      });
    }
  }

  renderToggle() {
    const options = [{id: 'table', name: t('Table')}];

    if (this.props.query.aggregations.length) {
      options.push({id: 'line', name: t('Line')}, {id: 'bar', name: t('Bar')});
    }

    if (this.props.chartData) {
      options.push(
        {id: 'line-by-day', name: t('Line by Day')},
        {id: 'bar-by-day', name: t('Bar by Day')}
      );
    }

    return (
      <Flex justify="flex-end" align="center" my={2}>
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
      </Flex>
    );
  }

  renderSummary() {
    const {data, chartData} = this.props;
    const baseViews = ['table', 'line', 'bar'];
    const summaryData = baseViews.includes(this.state.view) ? data : chartData;

    return (
      <Summary>
        query time: {summaryData.timing.duration_ms} ms, {summaryData.data.length} rows
      </Summary>
    );
  }

  render() {
    const {data, query, chartQuery, chartData} = this.props;
    const {view} = this.state;

    const basicChartData = getChartData(data.data, query);

    return (
      <div>
        {this.renderToggle()}

        {view === 'table' && <Table data={data} />}
        {view === 'line' && <LineChart series={basicChartData} height={300} />}
        {view === 'bar' && (
          <BarChart
            series={basicChartData}
            height={300}
            options={{
              tooltip: Tooltip({
                formatter: formatTooltip,
              }),
            }}
          />
        )}
        {view === 'line-by-day' && (
          <LineChart
            series={getChartDataByDay(chartData.data, chartQuery)}
            height={300}
          />
        )}
        {view === 'bar-by-day' && (
          <BarChart
            series={getChartDataByDay(chartData.data, chartQuery)}
            stacked={true}
            height={300}
            options={{
              tooltip: Tooltip({
                formatter: formatTooltip,
              }),
            }}
          />
        )}
        {this.renderSummary()}
      </div>
    );
  }
}

const Summary = styled(Box)`
  color: ${p => p.theme.gray6};
  font-size: 12px;
`;
