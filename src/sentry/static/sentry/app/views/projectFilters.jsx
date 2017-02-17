import React from 'react';
import _ from 'underscore';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import StackedBarChart from '../components/stackedBarChart';
import Switch from '../components/switch';
import {FormState, TextareaField} from '../components/forms';
import {t} from '../locale';
import marked from '../utils/marked';

const FilterSwitch = function(props) {
  return (
    <Switch size={props.size}
      isActive={props.data.active}
      toggle={function () {
        props.onToggle(props.data, !props.data.active);
      }} />
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
    onToggle: React.PropTypes.func.isRequired,
  },

  getInitialState() {
    return {
      loading: false,
      error: false,
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
              <small className="help-block" dangerouslySetInnerHTML={{
                __html: marked(data.description)
              }} />
            }
          </div>
          <div className="col-md-3 align-right" style={{paddingRight: '25px'}}>
            <FilterSwitch {...this.props} size="lg"/>
          </div>
        </div>
      </div>
    );
  }
});

const LEGACY_BROWSER_SUBFILTERS = {
  'ie_pre_9': {
    icon: 'internet-explorer',
    helpText: 'Version 8 and lower',
    title: 'Internet Explorer',
  },
  'ie9': {
    icon: 'internet-explorer',
    helpText: 'Version 9',
    title: 'Internet Explorer',
  },
  'ie10': {
    icon: 'internet-explorer',
    helpText: 'Version 10',
    title: 'Internet Explorer',
  },
  'opera_pre_15': {
    icon: 'opera',
    helpText: 'Version 14 and lower',
    title: 'Opera',
  },
  'safari_pre_6': {
    icon: 'safari',
    helpText: 'Version 5 and lower',
    title: 'Safari',
  },
  'android_pre_4': {
    icon: 'android',
    helpText: 'Version 3 and lower',
    title: 'Android',
  },
};

const LEGACY_BROWSER_KEYS = Object.keys(LEGACY_BROWSER_SUBFILTERS);

const LegacyBrowserFilterRow = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onToggle: React.PropTypes.func.isRequired,
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
      subfilters: initialSubfilters,
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

    this.setState({
      subfilters: new Set(subfilters)
    }, () => {
      this.props.onToggle(this.props.data, subfilters);
    });
  },

  renderSubfilters() {
    let entries = LEGACY_BROWSER_KEYS.map(key => {
      let subfilter = LEGACY_BROWSER_SUBFILTERS[key];
      return (
        <div className="col-md-4">
          <div className="filter-grid-item">
            <div className={'filter-grid-icon icon-' + subfilter.icon} />
            <h5>{subfilter.title}</h5>
            <p className="help-block">{subfilter.helpText}</p>
            <Switch isActive={this.state.subfilters.has(key)} toggle={this.onToggleSubfilters.bind(this, key)} size="lg"/>
          </div>
        </div>
      );
    });

    // group entries into rows of 3
    let rows = _.groupBy(entries, (entry, i) => Math.floor(i / 3));

    return _.toArray(rows).map((row, i) => <div className="row m-b-1" key={i}>{row}</div>);
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description &&
              <small className="help-block" dangerouslySetInnerHTML={{
                __html: marked(data.description)
              }} />
            }
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
      formData: formData,
      errors: {},
    };
  },

  onFieldChange(name, value) {
    let formData = this.state.formData;
    formData[name] = value;
    this.setState({
      formData: formData,
    });
  },

  onSubmit(e) {
    e.preventDefault();

    if (this.state.state === FormState.SAVING) {
      return;
    }
    this.setState({
      state: FormState.SAVING,
    }, () => {
      let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
      let {orgId, projectId} = this.props;
      this.api.request(`/projects/${orgId}/${projectId}/`, {
        method: 'PUT',
        data: {options: this.state.formData},
        success: (data) => {
          this.setState({
            state: FormState.READY,
            errors: {},
          });
        },
        error: (error) => {
          this.setState({
            state: FormState.ERROR,
            errors: error.responseJSON,
          });
        },
        complete: () => {
          IndicatorStore.remove(loadingIndicator);
        }
      });
    });
  },

  render() {
    let isSaving = this.state.state === FormState.SAVING;
    let errors = this.state.errors;
    return (
      <form onSubmit={this.onSubmit} className="form-stacked">
        {this.state.state === FormState.ERROR &&
          <div className="alert alert-error alert-block">
            {t('Unable to save your changes. Please ensure all fields are valid and try again.')}
          </div>
        }
        <fieldset>
          <TextareaField
            key="ip"
            name="ip"
            label={t('Filtered IP Addresses')}
            help={t('Separate multiple entries with a newline.')}
            placeholder="e.g. 127.0.0.1 or 10.0.0.0/8"
            value={this.state.formData['filters:blacklisted_ips']}
            error={errors['filters:blacklisted_ips']}
            onChange={this.onFieldChange.bind(this, 'filters:blacklisted_ips')} />
        </fieldset>
        <fieldset className="form-actions">
          <button type="submit" className="btn btn-primary"
                  disabled={isSaving}>{t('Save Changes')}</button>
        </fieldset>
      </form>
    );
  }
});

const ProjectFilters = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 7;

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
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          filterList: data
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          error: true,
          expected: expected,
          loading: expected > 0
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/stats/`, {
      query: {
        since: this.state.querySince,
        until: this.state.queryUntil,
        resolution: '1h',
        stat: 'blacklisted',
      },
      success: (data) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          rawStatsData: data,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          error: true,
        });
      }
    });

    this.api.request(`/projects/${orgId}/${projectId}/`, {
      success: (data, _, jqXHR) => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          loading: expected > 0,
          projectOptions: data.options,
        });
      },
      error: () => {
        let expected = this.state.expected - 1;
        this.setState({
          expected: expected,
          error: true,
          loading: expected > 0
        });
      }
    });
  },

  processStatsData() {
    let points = this.state.rawStatsData.map(point => {
      return {
        x: point[0],
        y: [point[1]],
      };
    });
    this.setState({
      stats: points,
    });
  },

  onToggleFilter(filter, active) {
    if (this.state.loading)
      return;

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

  renderBody() {
    let body;

    if (this.state.loading || !this.state.stats)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else
      body = this.renderResults();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;

    return (
      <div>
        <div className="inbound-filters-stats">
          <div className="bar-chart">
            <StackedBarChart
              points={this.state.stats}
              height={50}
              barClasses={['filtered']}
              className="sparkline" />
          </div>
        </div>
        {this.state.filterList.map(filter => {
          let props = {
            key: filter.id,
            data: filter,
            orgId: orgId,
            projectId: projectId,
            onToggle: this.onToggleFilter
          };
          return filter.id === 'legacy-browsers'
            ? <LegacyBrowserFilterRow {...props}/>
            : <FilterRow {...props}/>;
        })}

        <div className="box">
          <div className="box-header">
            <h3>{t('Settings')}</h3>
          </div>
          <div className="box-content with-padding">
            <ProjectFiltersSettingsForm
              orgId={orgId}
              projectId={projectId}
              initialData={this.state.projectOptions} />
          </div>
        </div>
      </div>
    );
  },

  render() {
    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h1>{t('Inbound Data Filters')}</h1>
        <p>Filters allow you to prevent Sentry from storing events in certain situations. Filtered events are tracked separately from rate limits, and do not apply to any project quotas.</p>
        {this.renderBody()}
      </div>
    );
  }
});

export default ProjectFilters;
