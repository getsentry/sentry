import React from 'react';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {Box, Flex} from 'grid-emotion';

import SentryTypes from 'app/sentryTypes';
import {t, tct} from 'app/locale';
import Link from 'app/components/link';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import space from 'app/styles/space';

import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';

import {getChartData, getChartDataByDay, downloadAsCsv, generateQueryName} from './utils';
import {createSavedQuery} from '../utils';
import Table from './table';
import {
  Heading,
  EditableName,
  ResultSummary,
  ChartWrapper,
  ChartNote,
  SavedQueryAction,
} from '../styles';
import {NUMBER_OF_SERIES_BY_DAY} from '../data';

export default class Result extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    data: PropTypes.object,
    queryBuilder: PropTypes.object,
    savedQuery: PropTypes.object, // Provided if it's a saved search
  };

  constructor() {
    super();
    this.state = {
      view: 'table',
      isEditMode: false,
      savedQueryName: null,
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
      isEditMode: false,
      savedQueryName: null,
    });
  }

  toggleEditMode = () => {
    const {savedQuery} = this.props;
    this.setState(state => {
      const isEditMode = !state.isEditMode;
      return {
        isEditMode,
        savedQueryName: isEditMode
          ? savedQuery ? savedQuery.name : generateQueryName()
          : null,
      };
    });
  };

  confirmSave = () => {
    const {organization, queryBuilder} = this.props;
    const {savedQueryName} = this.state;
    const data = {...queryBuilder.getInternal(), name: savedQueryName};

    createSavedQuery(organization, data)
      .then(savedQuery => {
        addSuccessMessage(
          tct('Successfully saved query [name]', {name: savedQuery.name})
        );
        browserHistory.push({
          pathname: `/organizations/${this.props.organization
            .slug}/discover/saved/${savedQuery.id}/`,
        });
      })
      .catch(() => {
        addErrorMessage(t('Could not save query'));
      });
  };

  updateSavedQueryName = val => {
    this.setState({savedQueryName: val});
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

    const linkClasses = 'btn btn-default btn-sm';

    return (
      <Flex flex="1" justify="flex-end">
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
      : byDayQuery.data;

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

  renderSavedQueryHeader() {
    return (
      <Flex>
        <Heading>{this.props.savedQuery.name}</Heading>
      </Flex>
    );
  }

  renderQueryResultHeader() {
    const {isEditMode, savedQueryName} = this.state;

    return (
      <React.Fragment>
        {!isEditMode && (
          <Flex>
            <Heading>{t('Result')}</Heading>
            <SavedQueryAction onClick={this.toggleEditMode}>{t('Save')}</SavedQueryAction>
          </Flex>
        )}
        {isEditMode && (
          <Flex>
            <EditableName value={savedQueryName} onChange={this.updateSavedQueryName} />
            <SavedQueryAction onClick={this.confirmSave}>
              {t('Confirm save')}
            </SavedQueryAction>
            <SavedQueryAction onClick={this.toggleEditMode}>
              {t('Cancel')}
            </SavedQueryAction>
          </Flex>
        )}
      </React.Fragment>
    );
  }

  render() {
    const {data: {baseQuery, byDayQuery}, savedQuery} = this.props;
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
      <Box flex="1">
        <Flex align="center" mb={space(2)}>
          <Box flex="1">
            {savedQuery ? this.renderSavedQueryHeader() : this.renderQueryResultHeader()}
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
              legend={{data: [baseQuery.query.aggregations[0][2]], truncate: 80}}
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
