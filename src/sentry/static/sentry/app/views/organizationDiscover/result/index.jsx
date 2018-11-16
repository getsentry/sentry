import React from 'react';
import PropTypes from 'prop-types';
import {Box, Flex} from 'grid-emotion';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';
import Link from 'app/components/link';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';
import InlineSvg from 'app/components/inlineSvg';

import {getChartData, getChartDataByDay, getRowsPageRange} from './utils';
import Table from './table';
import Pagination from './pagination';
import VisualizationsToggle from './visualizationsToggle';
import {
  ResultTitle,
  Heading,
  ResultSummary,
  ResultContainer,
  ResultInnerContainer,
  ChartWrapper,
  ChartNote,
  SavedQueryAction,
  ResultSummaryAndButtons,
} from '../styles';
import {NUMBER_OF_SERIES_BY_DAY} from '../data';

export default class Result extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
    savedQuery: SentryTypes.DiscoverSavedQuery, // Provided if it's a saved search
    onFetchPage: PropTypes.func.isRequired,
    onToggleEdit: PropTypes.func,
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

    this.setState({
      savedQueryName: null,
    });
  }

  handleToggleVisualizations = opt => {
    this.setState({
      view: opt,
    });
  };

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

    return (
      <div>
        <VisualizationsToggle
          options={options}
          handleChange={this.handleToggleVisualizations}
          visualization={this.state.view}
        />
      </div>
    );
  }

  renderSummary() {
    const {baseQuery, byDayQuery} = this.props.data;
    const baseViews = ['table', 'line', 'bar'];
    const summaryData = baseViews.includes(this.state.view)
      ? baseQuery.data
      : byDayQuery.data;

    const summary = [
      `query time: ${getDynamicText({
        value: summaryData.timing.duration_ms,
        fixed: '10',
      })} ms`,
    ];
    if (this.state.view === 'table') {
      summary.push(getRowsPageRange(baseQuery));
    }
    return <ResultSummary>{summary.join(', ')}</ResultSummary>;
  }

  renderNote() {
    return (
      <ChartNote>{t(`Displaying up to ${NUMBER_OF_SERIES_BY_DAY} results`)}</ChartNote>
    );
  }

  renderSavedQueryHeader() {
    return (
      <Flex align="center">
        <Heading>
          {getDynamicText({value: this.props.savedQuery.name, fixed: 'saved query'})}
        </Heading>
        <SavedQueryAction onClick={this.props.onToggleEdit}>
          <InlineSvg src="icon-edit" />
        </SavedQueryAction>
      </Flex>
    );
  }

  renderQueryResultHeader() {
    return (
      <Flex>
        <Heading>{t('Result')}</Heading>
      </Flex>
    );
  }

  render() {
    const {data: {baseQuery, byDayQuery}, savedQuery, onFetchPage} = this.props;

    const {view} = this.state;

    const basicChartData = getChartData(baseQuery.data.data, baseQuery.query);

    const byDayChartData =
      byDayQuery.data && getChartDataByDay(byDayQuery.data.data, byDayQuery.query);

    const legendData = byDayChartData
      ? {data: byDayChartData.map(entry => entry.seriesName), truncate: 80}
      : null;

    const tooltipOptions = {
      filter: value => value !== null,
      truncate: 80,
    };

    return (
      <ResultContainer>
        <Box mb={space(2)}>
          <ResultTitle>
            {savedQuery ? this.renderSavedQueryHeader() : this.renderQueryResultHeader()}
          </ResultTitle>
          {this.renderToggle()}
        </Box>
        <ResultInnerContainer innerRef={ref => (this.container = ref)}>
          {view === 'table' && (
            <Table
              data={baseQuery.data}
              query={baseQuery.query}
              height={this.container && this.container.clientHeight}
            />
          )}
          {view === 'line' && (
            <ChartWrapper>
              <LineChart
                series={basicChartData}
                height={300}
                tooltip={tooltipOptions}
                legend={{data: [baseQuery.query.aggregations[0][2]], truncate: 80}}
                xAxis={{truncate: 80}}
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
                legend={{data: [baseQuery.query.aggregations[0][2]], truncate: 80}}
                xAxis={{truncate: 80}}
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
          <ResultSummaryAndButtons>
            {this.renderSummary()}
            {!baseQuery.query.aggregations.length && (
              <Pagination
                previous={baseQuery.previous}
                next={baseQuery.next}
                getNextPage={() => onFetchPage('next')}
                getPreviousPage={() => onFetchPage('previous')}
              />
            )}
          </ResultSummaryAndButtons>
        </ResultInnerContainer>
      </ResultContainer>
    );
  }
}
