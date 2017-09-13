import React from 'react';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';

import ApiMixin from '../../mixins/apiMixin';
import IndicatorStore from '../../stores/indicatorStore';
import GroupTombstones from '../../components/groupTombstones';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import ProjectState from '../../mixins/projectState';
import StackedBarChart from '../../components/stackedBarChart';
import {t} from '../../locale';
import {intcomma} from '../../utils';

import FilterRow from './filterRow';
import LegacyBrowserFilterRow from './legacyBrowserFilterRow';
import ProjectFiltersSettingsForm from './projectFiltersSettingsForm';

const ProjectFilters = React.createClass({
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      expected: 3,
      loading: true,
      error: false,
      statsError: false,
      filterList: [],
      querySince: since,
      queryUntil: until,
      rawStatsData: null,
      formattedData: [],
      projectOptions: {},
      blankStats: true,
      activeSection: 'data-filters',
      tombstones: [],
      tombstoneError: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (!this.state.loading && !this.state.formattedData) {
      this.render();
    }
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
      blacklisted: 'Filtered Events' //TODO(maxbittker) this is only needed until October 10th, 2017
    };
  },

  formatData(rawData) {
    let cutOverDate = moment([2017, 8, 11]); // date when detailed stats started being recorded

    return Object.keys(this.getStatOpts()).map(stat => {
      return {
        data: rawData[stat].map(([x, y]) => {
          if (y > 0) {
            this.setState({blankStats: false});
          }

          //TODO(maxbittker) this is only needed until October 10th, 2017 :
          let statDate = moment(x * 1000);
          let timeSince = cutOverDate.diff(statDate, 'days');
          // this means detailed stats are available
          if (
            (timeSince < 0 && stat === 'blacklisted') ||
            (timeSince >= 0 && stat !== 'blacklisted')
          ) {
            return {x, y: 0};
          }
          //END

          return {x, y};
        }),
        label: this.getStatOpts()[stat],
        statName: stat
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
      resolution: '1d'
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
            error: deferred.reject.bind(deferred)
          });
          return deferred;
        })
      )
      .done(
        function(/* statOption1, statOption2, ... statOptionN */) {
          let rawStatsData = {};
          let expected = this.state.expected - 1;
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
            expected,
            loading: expected > 0
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
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/filters/`, {
      success: (data, textStatus, jqXHR) => {
        this.setState({filterList: data});
      },
      error: () => {
        this.setState({error: true});
      },
      complete: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          loading: expected > 0
        });
      }
    });

    this.getFilterStats();

    this.api.request(`/projects/${orgId}/${projectId}/`, {
      success: (data, textStatus, jqXHR) => {
        this.setState({projectOptions: data.options});
      },
      error: () => {
        this.setState({error: true});
      },
      complete: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected,
          loading: expected > 0
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/tombstones/`, {
      method: 'GET',
      success: tombstones => {
        this.setState({tombstones});
      },
      error: () => {
        this.setState({
          tombstoneError: true
        });
      }
    });
  },

  onToggleFilter(filter, active) {
    if (this.state.loading) return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId} = this.props.params;

    let endpoint = `/projects/${orgId}/${projectId}/filters/${filter.id}/`; // ?id=a&id=b

    let data;
    if (typeof active === 'boolean') {
      data = {active};
    } else {
      data = {subfilters: active};
    }
    this.api.request(endpoint, {
      method: 'PUT',
      data,
      success: (d, textStatus, jqXHR) => {
        let stateFilter = this.state.filterList.find(f => f.id === filter.id);
        stateFilter.active = active;

        this.setState({
          filterList: [...this.state.filterList]
        });
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
      }
    });
  },

  setProjectNavSection(section) {
    this.setState({
      activeSection: section
    });
  },

  renderBody() {
    let body;

    if (this.state.loading || !this.state.formattedData) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else body = this.renderResults();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderSection() {
    let activeSection = this.state.activeSection;
    let {orgId, projectId} = this.props.params;
    if (activeSection == 'data-filters') {
      return (
        <div>
          {this.state.filterList.map(filter => {
            let props = {
              key: filter.id,
              data: filter,
              orgId,
              projectId,
              onToggle: this.onToggleFilter
            };
            return filter.id === 'legacy-browsers'
              ? <LegacyBrowserFilterRow {...props} />
              : <FilterRow {...props} />;
          })}

          <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
            <ProjectFiltersSettingsForm
              orgId={orgId}
              projectId={projectId}
              initialData={this.state.projectOptions}
            />
          </div>
        </div>
      );
    } else {
      return (
        <GroupTombstones
          orgId={orgId}
          projectId={projectId}
          tombstones={this.state.tombstones}
          tombstoneError={this.state.tombstoneError}
          fetchData={this.fetchData}
        />
      );
    }
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
        <div className="time-label"><span>{timeLabel}</span></div>
        <div>{intcomma(totalY)} {totalY != 1 ? t('total events') : t('total event')}</div>
        {formattedData.map((dataPoint, i) => {
          return (
            point.y[i] > 0 &&
            <dl className="legend" key={dataPoint.statName}>
              <dt><span className={`${dataPoint.statName} 'filter-color'`} /></dt>
              <dd style={{textAlign: 'left', position: 'absolute'}}>
                {dataPoint.label}{' '}
              </dd>
              <dd style={{textAlign: 'right', position: 'relative'}}>
                {point.y[i]} {point.y[i] != 1 ? t('events') : t('event')}
              </dd>
            </dl>
          );
        })}
      </div>
    );
  },

  renderResults() {
    let navSection = this.state.activeSection;
    let features = this.getProjectFeatures();

    return (
      <div>
        <div className="box">
          <div className="box-header">
            <h5>{t('Errors filtered in the last 30 days (by day)')}</h5>
          </div>
          {!this.state.blankStats
            ? <StackedBarChart
                series={this.state.formattedData}
                label="events"
                barClasses={Object.keys(this.getStatOpts())}
                className="standard-barchart filtered-stats-barchart"
                tooltip={this.renderTooltip}
              />
            : <div className="box-content">
                <div className="blankslate p-y-2">
                  <h5>{t('Nothing filtered in the last 30 days.')}</h5>
                  <p className="m-b-0">
                    {t(
                      'Issues filtered as a result of your settings below will be shown here.'
                    )}
                  </p>
                </div>
              </div>}
        </div>
        {features.has('custom-filters') &&
          <div className="sub-header flex flex-container flex-vertically-centered">
            <div className="p-t-1">
              <ul className="nav nav-tabs">
                <li
                  className={`col-xs-5  ${navSection == 'data-filters' ? 'active ' : ''}`}>
                  <a onClick={() => this.setProjectNavSection('data-filters')}>
                    {t('Data Filters')}
                  </a>
                </li>
                <li
                  className={`col-xs-5 align-right ${navSection == 'discarded-groups' ? 'active ' : ''}`}>
                  <a onClick={() => this.setProjectNavSection('discarded-groups')}>
                    {t('Discarded Groups')}
                  </a>
                </li>
              </ul>
            </div>
          </div>}
        {this.renderSection()}
      </div>
    );
  },

  render() {
    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('Inbound Data Filters')}</h1>
        <p>
          Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.
        </p>
        {this.renderBody()}
      </div>
    );
  }
});

export default ProjectFilters;
