import PropTypes from 'prop-types';
import React from 'react';
import _ from 'lodash';
import ReactDOMServer from 'react-dom/server';
import moment from 'moment';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import GroupTombstones from '../components/groupTombstones';
import HookStore from '../stores/hookStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import StackedBarChart from '../components/stackedBarChart';
import Switch from '../components/switch';
import {FormState, TextareaField} from '../components/forms';
import {t, tn} from '../locale';
import {intcomma} from '../utils';
import marked from '../utils/marked';

const FilterSwitch = function(props) {
  return (
    <Switch
      size={props.size}
      isActive={props.data.active}
      toggle={function() {
        props.onToggle(props.data, !props.data.active);
      }}
    />
  );
};

FilterSwitch.propTypes = {
  data: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
  size: PropTypes.string.isRequired
};

const FilterRow = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  onToggleSubfilters(active) {
    this.props.onToggle(this.props.data.subFilters, active);
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description && (
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />
            )}
          </div>
          <div className="col-md-3 align-right" style={{paddingRight: '25px'}}>
            <FilterSwitch {...this.props} size="lg" />
          </div>
        </div>
      </div>
    );
  }
});

const LEGACY_BROWSER_SUBFILTERS = {
  ie_pre_9: {
    icon: 'internet-explorer',
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer'
  },
  ie9: {
    icon: 'internet-explorer',
    helpText: 'Version 9',
    title: 'Internet Explorer'
  },
  ie10: {
    icon: 'internet-explorer',
    helpText: 'Version 10',
    title: 'Internet Explorer'
  },
  opera_pre_15: {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera'
  },
  safari_pre_6: {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari'
  },
  android_pre_4: {
    icon: 'android',
    helpText: 'Version 3 and lower',
    title: 'Android'
  }
};

const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

const LegacyBrowserFilterRow = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired
  },

  getInitialState() {
    let initialSubfilters;
    if (this.props.data.active === true) {
      initialSubfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (this.props.data.active === false) {
      initialSubfilters = new Set();
    } else {
      initialSubfilters = new Set(this.props.data.active);
    }
    return {
      loading: false,
      error: false,
      subfilters: initialSubfilters
    };
  },

  onToggleSubfilters(subfilter) {
    let {subfilters} = this.state;

    if (subfilter === true) {
      subfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (subfilter === false) {
      subfilters = new Set();
    } else if (subfilters.has(subfilter)) {
      subfilters.delete(subfilter);
    } else {
      subfilters.add(subfilter);
    }

    this.setState(
      {
        subfilters: new Set(subfilters)
      },
      () => {
        this.props.onToggle(this.props.data, subfilters);
      }
    );
  },

  renderSubfilters() {
    let entries = LEGACY_BROWSER_KEYS.map(key => {
      let subfilter = LEGACY_BROWSER_SUBFILTERS[key];
      return (
        <div className="col-md-4" key={key}>
          <div className="filter-grid-item">
            <div className={'filter-grid-icon icon-' + subfilter.icon} />
            <h5>{subfilter.title}</h5>
            <p className="help-block">{subfilter.helpText}</p>
            <Switch
              isActive={this.state.subfilters.has(key)}
              toggle={this.onToggleSubfilters.bind(this, key)}
              size="lg"
            />
          </div>
        </div>
      );
    });

    // group entries into rows of 3
    let rows = _.groupBy(entries, (entry, i) => Math.floor(i / 3));

    return _.toArray(rows).map((row, i) => (
      <div className="row m-b-1" key={i}>
        {row}
      </div>
    ));
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description && (
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />
            )}
          </div>
          <div className="col-md-3 align-right">
            <div className="filter-grid-filter">
              <strong>Filter:</strong>
              <a onClick={this.onToggleSubfilters.bind(this, true)}>All</a>
              <span className="divider" />
              <a onClick={this.onToggleSubfilters.bind(this, false)}>None</a>
            </div>
          </div>
        </div>

        {this.renderSubfilters()}
      </div>
    );
  }
});

const ProjectFiltersSettingsForm = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    initialData: PropTypes.object.isRequired
  },

  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    let features = this.getProjectFeatures();
    let formData = {};
    Object.keys(this.props.initialData)
      .filter(
        key =>
          // the project details endpoint can partially succeed and still return a 400
          // if the org does not have the additional-data-filters feature enabled,
          // so this prevents the form from sending an empty string by default
          features.has('custom-inbound-filters') ||
          (key !== 'filters:releases' && key !== 'filters:error_messages')
      )
      .forEach(key => {
        formData[key] = this.props.initialData[key];
      });
    return {
      hasChanged: false,
      formData,
      errors: {},
      hooksDisabled: HookStore.get('project:custom-inbound-filters:disabled')
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: {...formData},
      hasChanged: true
    });
  },

  onSubmit(e) {
    e.preventDefault();
    if (this.state.state === FormState.SAVING) {
      return;
    }
    this.setState(
      {
        state: FormState.SAVING
      },
      () => {
        let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
        let {orgId, projectId} = this.props;
        this.api.request(`/projects/${orgId}/${projectId}/`, {
          method: 'PUT',
          data: {options: this.state.formData},
          success: data => {
            this.setState({
              state: FormState.READY,
              errors: {},
              hasChanged: false
            });
          },
          error: error => {
            this.setState({
              state: FormState.ERROR,
              errors: error.responseJSON
            });
          },
          complete: () => {
            IndicatorStore.remove(loadingIndicator);
          }
        });
      }
    );
  },

  renderLinkToGlobWiki() {
    return (
      <span>
        {t('Separate multiple entries with a newline. Allows ')}
        <a href="https://en.wikipedia.org/wiki/Glob_(programming)">
          {t('glob pattern matching.')}
        </a>
      </span>
    );
  },

  renderAdditionalFilters() {
    let errors = this.state.errors;
    return (
      <div>
        <h5>{t('Filter errors from these releases:')}</h5>
        <TextareaField
          key="release"
          name="release"
          help={this.renderLinkToGlobWiki()}
          placeholder="e.g. 1.* or [!3].[0-9].*"
          value={this.state.formData['filters:releases']}
          error={errors['filters:releases']}
          onChange={this.onFieldChange.bind(this, 'filters:releases')}
        />
        <h5>{t('Filter errors by error message:')}</h5>
        <TextareaField
          key="errorMessage"
          name="errorMessage"
          help={this.renderLinkToGlobWiki()}
          placeholder="e.g. TypeError* or *: integer division or modulo by zero"
          value={this.state.formData['filters:error_messages']}
          error={errors['filters:error_messages']}
          onChange={this.onFieldChange.bind(this, 'filters:error_messages')}
        />
      </div>
    );
  },

  renderDisabledFeature() {
    let project = this.getProject();
    let organization = this.getOrganization();
    return this.state.hooksDisabled.map(hook => hook(organization, project));
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    let features = this.getProjectFeatures();

    return (
      <form onSubmit={this.onSubmit} className="form-stacked p-b-1">
        {this.state.state === FormState.ERROR && (
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>
        )}
        <fieldset>
          <h5>{t('Filter errors from these IP addresses:')}</h5>
          <TextareaField
            key="ip"
            name="ip"
            help={t('Separate multiple entries with a newline.')}
            placeholder="e.g. 127.0.0.1 or 10.0.0.0/8"
            value={this.state.formData['filters:blacklisted_ips']}
            error={errors['filters:blacklisted_ips']}
            onChange={this.onFieldChange.bind(this, 'filters:blacklisted_ips')}
          />
          {features.has('custom-inbound-filters') ? (
            this.renderAdditionalFilters()
          ) : (
            this.renderDisabledFeature()
          )}
          <div className="pull-right">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={isSaving || !this.state.hasChanged}>
              {t('Save Changes')}
            </button>
          </div>
        </fieldset>
      </form>
    );
  }
});

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
            return filter.id === 'legacy-browsers' ? (
              <LegacyBrowserFilterRow {...props} />
            ) : (
              <FilterRow {...props} />
            );
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
        <div>{intcomma(totalY)} {tn('total event', 'total events', totalY)}</div>
        {formattedData.map((dataPoint, i) => {
          return (
            point.y[i] > 0 &&
            <dl className="legend" key={dataPoint.statName}>
              <dt><span className={`${dataPoint.statName} 'filter-color'`} /></dt>
              <dd style={{textAlign: 'left', position: 'absolute'}}>
                {dataPoint.label}{' '}
              </dd>
              <dd style={{textAlign: 'right', position: 'relative'}}>
                {point.y[i]} {tn('event', 'events', point.y[i])}
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
                  <h5>
                    {t('Nothing filtered in the last 30 days.')}
                  </h5>
                  <p className="m-b-0">
                    {t(
                      'Issues filtered as a result of your settings below will be shown here.'
                    )}
                  </p>
                </div>
              </div>}
        </div>
        {features.has('custom-filters') && (
          <div className="sub-header flex flex-container flex-vertically-centered">
            <div className="p-t-1">
              <ul className="nav nav-tabs">
                <li
                  className={`col-xs-5  ${navSection == 'data-filters'
                    ? 'active '
                    : ''}`}>
                  <a onClick={() => this.setProjectNavSection('data-filters')}>
                    {t('Data Filters')}
                  </a>
                </li>
                <li
                  className={`col-xs-5 align-right ${navSection == 'discarded-groups'
                    ? 'active '
                    : ''}`}>
                  <a onClick={() => this.setProjectNavSection('discarded-groups')}>
                    {t('Discarded Groups')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        )}
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
          {t(
            'Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.'
          )}
        </p>
        {this.renderBody()}
      </div>
    );
  }
});

export default ProjectFilters;
