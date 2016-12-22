import React from 'react';
import _ from 'underscore';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Switch from '../components/switch';
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
    if (this.props.data.active === '1') {
      initialSubfilters = new Set(LEGACY_BROWSER_KEYS);
    } else if (this.props.data.active === '0') {
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

const ProjectFilters = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      filterList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/filters/`, {
      success: (data, textStatus, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          filterList: data
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
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

    if (this.state.loading)
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
