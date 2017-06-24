import React from 'react';
import _ from 'lodash';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import GroupTombstones from '../components/groupTombstones';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import ProjectState from '../mixins/projectState';
import StackedBarChart from '../components/stackedBarChart';
import Switch from '../components/switch';
import {FormState, TextareaField} from '../components/forms';
import {t} from '../locale';
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
  data: React.PropTypes.object.isRequired,
  onToggle: React.PropTypes.func.isRequired,
  size: React.PropTypes.string.isRequired
};

const FilterRow = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onToggle: React.PropTypes.func.isRequired
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
            {data.description &&
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />}
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
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onToggle: React.PropTypes.func.isRequired
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
      <div className="row m-b-1" key={i}>{row}</div>
    ));
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description &&
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />}
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
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    initialData: React.PropTypes.object.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    let formData = {};
    for (let key of Object.keys(this.props.initialData)) {
      if (key.lastIndexOf('filters:') === 0) {
        formData[key] = this.props.initialData[key];
      }
    }
    return {
      hasChanged: false,
      formData: formData,
      errors: {}
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

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    return (
      <form onSubmit={this.onSubmit} className="form-stacked p-b-1">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t(
              'Unable to save your changes. Please ensure all fields are valid and try again.'
            )}
          </div>}
        <fieldset>
          <div className="pull-right">

            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={isSaving || !this.state.hasChanged}>
              {t('Save Changes')}
            </button>

          </div>
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
      stats: null,
      rawStatsData: null,
      processedStats: false,
      projectOptions: {},
      blankStats: false,
      activeSection: 'data-filters',
      tombstones: [],
      tombstoneError: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    if (!this.state.loading && !this.state.stats) {
      this.processStatsData();
    }
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
          expected: expected,
          loading: expected > 0
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/stats/`, {
      query: {
        since: this.state.querySince,
        until: this.state.queryUntil,
        resolution: '1d',
        stat: 'blacklisted'
      },
      success: data => {
        this.setState({rawStatsData: data});
      },
      error: () => {
        this.setState({error: true});
      },
      complete: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0
        });
      }
    });

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
          expected: expected,
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

  processStatsData() {
    let blank = true; // Keep track if the entire graph is blank or not.
    let points = this.state.rawStatsData.map(point => {
      let [x, y] = point;
      if (y > 0) {
        blank = false;
      }
      return {
        x: x,
        y: [y]
      };
    });
    this.setState({
      stats: points,
      blankStats: blank
    });
  },

  onToggleFilter(filter, active) {
    if (this.state.loading) return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId} = this.props.params;

    let endpoint = `/projects/${orgId}/${projectId}/filters/${filter.id}/`; // ?id=a&id=b

    let data;
    if (typeof active === 'boolean') {
      data = {active: active};
    } else {
      data = {subfilters: active};
    }
    this.api.request(endpoint, {
      method: 'PUT',
      data: data,
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

    if (this.state.loading || !this.state.stats) body = this.renderLoading();
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
              orgId: orgId,
              projectId: projectId,
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
                points={this.state.stats}
                height={50}
                label="events"
                barClasses={['filtered']}
                className="standard-barchart"
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
