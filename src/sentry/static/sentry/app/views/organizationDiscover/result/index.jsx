import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';

import {t} from 'app/locale';
import Link from 'app/components/link';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import Panel from 'app/components/panels/panel';
import space from 'app/styles/space';

import {getChartData, getChartDataByDay, downloadAsCsv} from './utils';
import Table from './table';
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
    const {data, query, chartData} = this.props;

    const options = [{id: 'table', name: t('Table')}];

    if (query.aggregations.length) {
      options.push({id: 'line', name: t('Line')}, {id: 'bar', name: t('Bar')});
    }

    if (chartData) {
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
          <Link className={linkClasses} onClick={() => downloadAsCsv(data)}>
            {t('Export CSV')}
          </Link>
        </Box>
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

  renderNote() {
    return <Note>{t(`Displaying up to ${NUMBER_OF_SERIES_BY_DAY} results`)}</Note>;
  }

  render() {
    const {data, query, chartQuery, chartData} = this.props;
    const {view} = this.state;

    const basicChartData = getChartData(data.data, query);

    const byDayChartData = chartData && getChartDataByDay(chartData.data, chartQuery);

    const legendData = byDayChartData
      ? byDayChartData.map(entry => entry.seriesName)
      : null;

    const tooltipOptions = {
      filter: value => value !== null,
      truncate: 80,
    };

    return (
      <Results>
        <Flex align="center" mb={space(2)}>
          <Box flex="1">
            <Heading>{t('Result')}</Heading>
          </Box>
          {this.renderToggle()}
        </Flex>

        {view === 'table' && <Table data={data} query={query} />}
        {view === 'line' && (
          <ChartWrapper>
            <LineChart
              series={basicChartData}
              height={300}
              tooltip={tooltipOptions}
              legend={{data: [query.aggregations[0][2]]}}
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
              legend={{data: [query.aggregations[0][2]]}}
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
              legend={legendData ? {data: legendData} : null}
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
              legend={legendData ? {data: legendData} : null}
              renderer="canvas"
            />
            {this.renderNote()}
          </ChartWrapper>
        )}
        {this.renderSummary()}
      </Results>
    );
  }
}

const Results = styled('div')`
  flex: 1;
`;

const ChartWrapper = styled(Panel)`
  padding: ${space(3)} ${space(2)};
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
`;
