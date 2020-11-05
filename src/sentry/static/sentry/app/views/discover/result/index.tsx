import React from 'react';
import {browserHistory} from 'react-router';
import throttle from 'lodash/throttle';

import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';
import BarChart from 'app/components/charts/barChart';
import LineChart from 'app/components/charts/lineChart';
import PageHeading from 'app/components/pageHeading';
import {IconEdit} from 'app/icons';

import {
  getChartData,
  getChartDataByDay,
  getRowsPageRange,
  downloadAsCsv,
  getVisualization,
} from './utils';
import Table from './table';
import Pagination from './pagination';
import VisualizationsToggle from './visualizationsToggle';
import {
  HeadingContainer,
  ResultSummary,
  ResultContainer,
  ResultInnerContainer,
  ChartWrapper,
  ChartNote,
  SavedQueryAction,
  ResultSummaryAndButtons,
} from '../styles';
import {NUMBER_OF_SERIES_BY_DAY} from '../data';
import {
  queryHasChanged,
  getQueryFromQueryString,
  getQueryStringFromQuery,
} from '../utils';
import {SavedQuery} from '../types';

type ResultProps = {
  data: any;
  location: any;
  savedQuery: SavedQuery | null; // Provided if it's a saved search
  onFetchPage: (nextOrPrev: string) => void;
  onToggleEdit: () => void;
  utc?: boolean | null;
};

type ResultState = {
  view: string;
  height: number | null;
  width: number | null;
};

class Result extends React.Component<ResultProps, ResultState> {
  constructor(props: ResultProps) {
    super(props);
    this.state = {
      view: getVisualization(props.data, props.location.query.visualization),
      height: null,
      width: null,
    };
  }

  componentDidMount() {
    window.addEventListener('resize', this.throttledUpdateDimensions);
  }

  UNSAFE_componentWillReceiveProps(nextProps: ResultProps) {
    const {data, location} = nextProps;
    const visualization = getVisualization(data, location.query.visualization);

    if (queryHasChanged(this.props.location.search, nextProps.location.search)) {
      const search = getQueryStringFromQuery(getQueryFromQueryString(location.search), {
        visualization,
      });

      this.setState({view: visualization});
      browserHistory.replace({
        pathname: location.pathname,
        search,
      });
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.throttledUpdateDimensions);
  }

  // This is the ref of the table container component
  private container: any;

  setDimensions = (ref: any) => {
    this.container = ref;
    if (ref && this.state.height === null) {
      this.updateDimensions();
    }
  };

  updateDimensions = () => {
    if (!this.container) {
      return;
    }

    this.setState({
      height: this.container.clientHeight,
      width: this.container.clientWidth,
    });
  };

  throttledUpdateDimensions = throttle(this.updateDimensions, 200, {trailing: true});

  handleToggleVisualizations = (opt: string) => {
    const {location} = this.props;
    this.setState({
      view: opt,
    });

    const search = getQueryStringFromQuery(getQueryFromQueryString(location.search), {
      visualization: opt,
    });

    browserHistory.push({
      pathname: location.pathname,
      search,
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

    const handleCsvDownload = () => downloadAsCsv(baseQuery.data);

    return (
      <div>
        <VisualizationsToggle
          options={options}
          handleChange={this.handleToggleVisualizations}
          handleCsvDownload={handleCsvDownload}
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
      })}ms`,
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
      <React.Fragment>
        <PageHeading>
          {getDynamicText({value: this.props.savedQuery!.name, fixed: 'saved query'})}
        </PageHeading>
        <SavedQueryAction to="" onClick={this.props.onToggleEdit}>
          <IconEdit />
        </SavedQueryAction>
      </React.Fragment>
    );
  }

  renderQueryResultHeader() {
    return <PageHeading>{t('Result')}</PageHeading>;
  }

  render() {
    const {
      data: {baseQuery, byDayQuery},
      savedQuery,
      onFetchPage,
      utc,
    } = this.props;

    const {view} = this.state;

    const basicChartData = getChartData(baseQuery.data.data, baseQuery.query);

    const byDayChartData =
      byDayQuery.data && getChartDataByDay(byDayQuery.data.data, byDayQuery.query);

    const legendData = byDayChartData
      ? {data: byDayChartData.map((entry: any) => entry.seriesName), truncate: 80}
      : undefined;

    const tooltipOptions = {
      filter: (value: any) => value !== null,
      truncate: 80,
    };

    return (
      <ResultContainer data-test-id="result">
        <div>
          <HeadingContainer>
            {savedQuery ? this.renderSavedQueryHeader() : this.renderQueryResultHeader()}
          </HeadingContainer>
          {this.renderToggle()}
        </div>
        <ResultInnerContainer ref={this.setDimensions}>
          {view === 'table' && (
            <Table
              data={baseQuery.data}
              query={baseQuery.query}
              height={this.state.height}
              width={this.state.width}
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
                options={{animation: false}}
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
                isGroupedByDate
                utc={utc ?? undefined}
              />
              {this.renderNote()}
            </ChartWrapper>
          )}
          {view === 'bar-by-day' && (
            <ChartWrapper>
              <BarChart
                series={byDayChartData}
                stacked
                height={300}
                tooltip={tooltipOptions}
                legend={legendData}
                renderer="canvas"
                isGroupedByDate
                utc={utc !== null && utc !== undefined ? utc : undefined}
                options={{animation: false}}
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
                getNextPage={() => {
                  onFetchPage('next');
                }}
                getPreviousPage={() => {
                  onFetchPage('previous');
                }}
              />
            )}
          </ResultSummaryAndButtons>
        </ResultInnerContainer>
      </ResultContainer>
    );
  }
}

export default Result;
