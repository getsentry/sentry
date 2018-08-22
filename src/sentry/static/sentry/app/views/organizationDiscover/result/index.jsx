import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';
import moment from 'moment';

import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';

import Table from './table';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object,
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
    if (!nextProps.chartData && this.state.view !== 'table') {
      this.setState({
        view: 'table',
      });
    }
  }

  // Converts a value to a string for the chart label. This could
  // potentially cause incorrect grouping, e.g. if the value null and string
  // 'null' are both present in the same series they will be merged into 1 value
  getLabel(value) {
    if (typeof value === 'object') {
      try {
        value = JSON.stringify(value);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    }

    return value;
  }

  getChartData(queryData, groupbyFields) {
    const {aggregations} = this.props.chartQuery;
    // We only chart the first aggregation for now
    const aggregate = aggregations[0][2];
    const dates = [
      ...new Set(queryData.map(entry => moment.utc(entry.time * 1000).format('MMM Do'))),
    ];
    const output = {};
    queryData.forEach(data => {
      const key = groupbyFields.length
        ? groupbyFields.map(field => this.getLabel(data[field])).join(',')
        : aggregate;
      if (key in output) {
        output[key].data.push({
          value: data[aggregate],
          name: moment.utc(data.time * 1000).format('MMM Do'),
        });
      } else {
        output[key] = {
          data: [
            {value: data[aggregate], name: moment.utc(data.time * 1000).format('MMM Do')},
          ],
        };
      }
    });
    const result = [];
    for (let key in output) {
      const addDates = dates.filter(
        date => !output[key].data.map(entry => entry.name).includes(date)
      );
      for (let i = 0; i < addDates.length; i++) {
        output[key].data.push({
          value: null,
          name: addDates[i],
        });
      }

      result.push({seriesName: key, data: output[key].data});
    }
    return result;
  }

  renderToggle() {
    const options = [{id: 'table', name: t('Table')}];

    if (this.props.chartData) {
      options.push({id: 'line', name: t('Line')}, {id: 'bar', name: t('Bar')});
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
    const summaryData = this.state.view === 'table' ? data : chartData;

    return (
      <Summary>
        query time: {summaryData.timing.duration_ms} ms, {summaryData.data.length} rows
      </Summary>
    );
  }

  render() {
    const {data, chartQuery, chartData} = this.props;
    const {view} = this.state;

    return (
      <div>
        {this.renderToggle()}

        {view === 'table' && <Table data={data} />}
        {view === 'line' && (
          <LineChart
            series={this.getChartData(chartData.data, chartQuery.fields)}
            height={300}
          />
        )}
        {view === 'bar' && (
          <BarChart
            series={this.getChartData(chartData.data, chartQuery.fields)}
            stacked={true}
            height={300}
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
