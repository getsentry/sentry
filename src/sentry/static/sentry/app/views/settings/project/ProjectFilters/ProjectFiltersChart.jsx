import PropTypes from 'prop-types';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import createReactClass from 'create-react-class';
import moment from 'moment';

import {intcomma} from 'app/utils';
import {t, tn} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import StackedBarChart from 'app/components/stackedBarChart';
import TextBlock from 'app/views/settings/components/text/textBlock';

const noMarginBottom = {marginBottom: 0};

const ProjectFiltersChart = createReactClass({
  displayName: 'ProjectFiltersChart',
  contextTypes: {
    project: PropTypes.object,
  },
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      loading: true,
      error: false,
      statsError: false,
      querySince: since,
      queryUntil: until,
      rawStatsData: null,
      formattedData: [],
      blankStats: true,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  getStatOpts() {
    return {
      'ip-address': 'IP Address',
      'release-version': 'Release',
      'error-message': 'Error Message',
      'browser-extensions': 'Browser Extension',
      'legacy-browsers': 'Legacy Browser',
      localhost: 'Localhost',
      'web-crawlers': 'Web Crawler',
      'invalid-csp': 'Invalid CSP',
      cors: 'CORS',
      'discarded-hash': 'Discarded Issue',
    };
  },

  formatData(rawData) {
    return Object.keys(this.getStatOpts()).map(stat => {
      return {
        data: rawData[stat].map(([x, y]) => {
          if (y > 0) {
            this.setState({blankStats: false});
          }

          return {x, y};
        }),
        label: this.getStatOpts()[stat],
        statName: stat,
      };
    });
  },

  getFilterStats() {
    let statOptions = Object.keys(this.getStatOpts());
    let {orgId, projectId} = this.props.params;
    let statEndpoint = `/projects/${orgId}/${projectId}/stats/`;
    let query = {
      since: this.state.querySince,
      until: this.state.queryUntil,
      resolution: '1d',
    };
    $.when
      .apply(
        $,
        // parallelize requests for each statistic
        statOptions.map(stat => {
          let deferred = $.Deferred();
          this.api.request(statEndpoint, {
            query: Object.assign({stat}, query),
            success: deferred.resolve.bind(deferred),
            error: deferred.reject.bind(deferred),
          });
          return deferred;
        })
      )
      .done(
        function(/* statOption1, statOption2, ... statOptionN */) {
          let rawStatsData = {};
          // when there is a single request made, this is inexplicably called without being wrapped in an array
          if (statOptions.length === 1) {
            rawStatsData[statOptions[0]] = arguments[0];
          } else {
            for (let i = 0; i < statOptions.length; i++) {
              rawStatsData[statOptions[i]] = arguments[i][0];
            }
          }

          this.setState({
            rawStatsData,
            formattedData: this.formatData(rawStatsData),
            error: false,
            loading: false,
          });
        }.bind(this)
      )
      .fail(
        function() {
          this.setState({error: true});
        }.bind(this)
      );
  },

  fetchData() {
    this.getFilterStats();
  },

  timeLabelAsDay(point) {
    let timeMoment = moment(point.x * 1000);

    return timeMoment.format('LL');
  },

  renderTooltip(point, pointIdx, chart) {
    let timeLabel = this.timeLabelAsDay(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }
    let {formattedData} = this.state;

    return ReactDOMServer.renderToStaticMarkup(
      <div style={{width: '175px'}}>
        <div className="time-label">
          <span>{timeLabel}</span>
        </div>
        <div>
          {intcomma(totalY)} {tn('total event', 'total events', totalY)}
        </div>
        {formattedData.map((dataPoint, i) => {
          return (
            point.y[i] > 0 && (
              <dl className="legend" key={dataPoint.statName}>
                <dt>
                  <span className={`${dataPoint.statName} 'filter-color'`} />
                </dt>
                <dd style={{textAlign: 'left', position: 'absolute'}}>
                  {dataPoint.label}{' '}
                </dd>
                <dd style={{textAlign: 'right', position: 'relative'}}>
                  {point.y[i]} {tn('event', 'events', point.y[i])}
                </dd>
              </dl>
            )
          );
        })}
      </div>
    );
  },

  render() {
    let {loading, error} = this.state;
    let isLoading = loading || !this.state.formattedData;
    let hasError = !isLoading && error;
    let hasLoaded = !isLoading && !error;

    return (
      <Panel>
        <PanelHeader>{t('Errors filtered in the last 30 days (by day)')}</PanelHeader>

        <PanelBody>
          {isLoading && <LoadingIndicator />}
          {hasError && <LoadingError onRetry={this.fetchData} />}
          {hasLoaded &&
            !this.state.blankStats && (
              <StackedBarChart
                series={this.state.formattedData}
                label="events"
                barClasses={Object.keys(this.getStatOpts())}
                className="standard-barchart filtered-stats-barchart"
                tooltip={this.renderTooltip}
              />
            )}
          {hasLoaded &&
            this.state.blankStats && (
              <EmptyMessage css={{flexDirection: 'column', alignItems: 'center'}}>
                <h3 css={noMarginBottom}>{t('Nothing filtered in the last 30 days.')}</h3>
                <TextBlock css={{fontSize: '0.9em', ...noMarginBottom}}>
                  {t(
                    'Issues filtered as a result of your settings below will be shown here.'
                  )}
                </TextBlock>
              </EmptyMessage>
            )}
        </PanelBody>
      </Panel>
    );
  },
});

export default ProjectFiltersChart;
