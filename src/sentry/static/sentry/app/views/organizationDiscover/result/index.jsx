import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';

import {t} from 'app/locale';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import Panel from 'app/components/panels/panel';
import space from 'app/styles/space';
import Tooltip from 'app/components/charts/components/tooltip';

import Table from './table';
import {getChartData, getChartDataByDay, formatTooltip} from './utils';
import {Heading} from '../styles';

import {NUMBER_OF_SERIES_BY_DAY} from '../data';

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

  renderNote() {
    return <Note>{t(`Displaying up to ${NUMBER_OF_SERIES_BY_DAY} results`)}</Note>;
  }

  render() {
    const {data, query, chartQuery, chartData} = this.props;
    const {view} = this.state;

    const basicChartData = getChartData(data.data, query);

    const byDayChartData = chartData && getChartDataByDay(chartData.data, chartQuery);

    return (
      <div>
        <Flex align="center" mb={space(2)}>
          <Box flex="1">
            <Heading>{t('Result')}</Heading>
          </Box>
          <Box justifySelf="flex-end">{this.renderToggle()}</Box>
        </Flex>

        {view === 'table' && <Table data={data} query={query} />}
        {view === 'line' && (
          <ChartWrapper>
            <LineChart
              series={basicChartData}
              height={300}
              options={{
                tooltip: Tooltip({
                  formatter: formatTooltip,
                }),
              }}
            />
          </ChartWrapper>
        )}
        {view === 'bar' && (
          <ChartWrapper>
            <BarChart
              series={basicChartData}
              height={300}
              options={{
                tooltip: Tooltip({
                  formatter: formatTooltip,
                }),
              }}
            />
          </ChartWrapper>
        )}
        {view === 'line-by-day' && (
          <ChartWrapper>
            <LineChart
              series={byDayChartData}
              height={300}
              options={{
                tooltip: Tooltip({
                  formatter: formatTooltip,
                }),
              }}
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
              options={{
                tooltip: Tooltip({
                  formatter: formatTooltip,
                }),
              }}
            />
            {this.renderNote()}
          </ChartWrapper>
        )}
        {this.renderSummary()}
      </div>
    );
  }
}

const ChartWrapper = styled(Panel)`
  padding-left: ${space(3)};
  padding-right: ${space(3)};
`;

const Summary = styled(Box)`
  color: ${p => p.theme.gray6};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-bottom: ${space(3)};
`;

const Note = styled(Box)`
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};
  margin-bottom: ${space(3)};
`;
