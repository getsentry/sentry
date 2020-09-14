import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';

import SentryTypes from 'app/sentryTypes';
import {intcomma} from 'app/utils';
import {t, tn} from 'app/locale';
import withApi from 'app/utils/withApi';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import StackedBarChart from 'app/components/stackedBarChart';
import {formatAbbreviatedNumber} from 'app/utils/formatters';

class ProjectFiltersChart extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    project: SentryTypes.Project,
  };

  constructor(props) {
    super(props);

    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;

    this.state = {
      loading: true,
      error: false,
      statsError: false,
      querySince: since,
      queryUntil: until,
      rawStatsData: null,
      formattedData: [],
      blankStats: true,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.project !== this.props.project) {
      this.fetchData();
    }
  }

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
  }

  formatData(rawData) {
    return Object.keys(this.getStatOpts()).map(stat => ({
      data: rawData[stat].map(([x, y]) => {
        if (y > 0) {
          this.setState({blankStats: false});
        }

        return {x, y};
      }),
      label: this.getStatOpts()[stat],
      statName: stat,
    }));
  }

  getFilterStats() {
    const statOptions = Object.keys(this.getStatOpts());
    const {project} = this.props;
    const {orgId} = this.props.params;
    const statEndpoint = `/projects/${orgId}/${project.slug}/stats/`;
    const query = {
      since: this.state.querySince,
      until: this.state.queryUntil,
      resolution: '1d',
    };
    const requests = statOptions.map(stat =>
      this.props.api.requestPromise(statEndpoint, {
        query: Object.assign({stat}, query),
      })
    );
    Promise.all(requests)
      .then(results => {
        const rawStatsData = {};
        for (let i = 0; i < statOptions.length; i++) {
          rawStatsData[statOptions[i]] = results[i];
        }

        this.setState({
          rawStatsData,
          formattedData: this.formatData(rawStatsData),
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({error: true, loading: false});
      });
  }

  fetchData = () => {
    this.getFilterStats();
  };

  timeLabelAsDay(point) {
    const timeMoment = moment(point.x * 1000);

    return timeMoment.format('LL');
  }

  renderTooltip = point => {
    const timeLabel = this.timeLabelAsDay(point);
    let totalY = 0;
    for (let i = 0; i < point.y.length; i++) {
      totalY += point.y[i];
    }
    const {formattedData} = this.state;

    return (
      <div style={{width: '175px'}}>
        <div className="time-label">
          <span>{timeLabel}</span>
        </div>
        <div>
          {intcomma(totalY)} {tn('total event', 'total events', totalY)}
        </div>
        {formattedData.map(
          (dataPoint, i) =>
            point.y[i] > 0 && (
              <dl className="legend" key={dataPoint.statName}>
                <dt>
                  <span className={`${dataPoint.statName} 'filter-color'`} />
                </dt>
                <dd style={{textAlign: 'left', position: 'absolute'}}>
                  {dataPoint.label}{' '}
                </dd>
                <dd style={{textAlign: 'right', position: 'relative'}}>
                  {formatAbbreviatedNumber(point.y[i])}{' '}
                  {tn('event', 'events', point.y[i])}
                </dd>
              </dl>
            )
        )}
      </div>
    );
  };

  render() {
    const {loading, error} = this.state;
    const isLoading = loading || !this.state.formattedData;
    const hasError = !isLoading && error;
    const hasLoaded = !isLoading && !error;
    const classes = Object.keys(this.getStatOpts());

    return (
      <Panel>
        <PanelHeader>{t('Errors filtered in the last 30 days (by day)')}</PanelHeader>

        <PanelBody>
          {isLoading && <LoadingIndicator />}
          {hasError && <LoadingError onRetry={this.fetchData} />}
          {hasLoaded && !this.state.blankStats && (
            <StackedBarChart
              series={this.state.formattedData}
              label="events"
              barClasses={classes}
              className="standard-barchart filtered-stats-barchart"
              tooltip={this.renderTooltip}
              minHeights={classes.map(p => (p === 'legacy-browsers' ? 1 : 0))}
            />
          )}
          {hasLoaded && this.state.blankStats && (
            <EmptyMessage
              title={t('Nothing filtered in the last 30 days.')}
              description={t(
                'Issues filtered as a result of your settings below will be shown here.'
              )}
            />
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export {ProjectFiltersChart};

export default withApi(ProjectFiltersChart);
