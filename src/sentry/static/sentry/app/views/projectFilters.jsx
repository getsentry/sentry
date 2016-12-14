import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Switch from '../components/switch';
import TooltipMixin from '../mixins/tooltip';
import {t} from '../locale';
import marked from '../utils/marked';

const FilterSwitch = React.createClass({
  propTypes: {
    data: React.PropTypes.object.isRequired,
    onToggle: React.PropTypes.func.isRequired,
    size: React.PropTypes.string.isRequired
  },

  getInitialState() {
    return {
      loading: false,
    };
  },

  toggle() {
    this.props.onToggle(this.props.data, !this.props.data.active);
  },

  render() {
    return(
      <Switch size={this.props.size}
        isActive={this.props.data.active}
        isLoading={this.state.loading}
        toggle={this.toggle} />
    );
  }
});

const FilterRow = React.createClass({
  propTypes: {
    orgId: React.PropTypes.string.isRequired,
    projectId: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    onToggle: React.PropTypes.func.isRequired,
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      selector: '.tip'
    })
  ],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  render() {
    let data = this.props.data;
    return (
      <tr>
        <td>
          <h5>{data.name}</h5>
          {data.description &&
            <small className="help-block" dangerouslySetInnerHTML={{
              __html: marked(data.description)
            }} />
          }
        </td>
        <td style={{textAlign: 'right'}}>
          {data.subFilters.length > 0 && <h5>All Legacy Browsers</h5>}
          <FilterSwitch {...this.props} size="lg"/>
          {data.subFilters.map(filter => {
            return (
              <div className="subfilter">
                <h5>{filter.name}</h5>
                <p className="help-block">{filter.description}</p>
                <FilterSwitch {...this.props} data={filter} size="lg"/>
              </div>
            );
          })}
        </td>
      </tr>
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
      success: (data, _, jqXHR) => {
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
    this.api.request(`/projects/${orgId}/${projectId}/filters/${filter.id}/`, {
      method: 'PUT',
      data: {
        active: !filter.active,
      },
      success: (d, _, jqXHR) => {
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

    let topLevelFilters = this.state.filterList.filter(filter => {
      return filter.id.indexOf(':') === -1;
    });

    topLevelFilters.forEach(topLevelFilter => {
      let subFilters = this.state.filterList.filter(filter => {
        return filter.id.startsWith(topLevelFilter.id + ':');
      });
      topLevelFilter.subFilters = subFilters;
    });

    return (
      <table className="table">
        <tbody>
          {topLevelFilters.map((filter) => {
            return (
              <FilterRow
                key={filter.id}
                data={filter}
                orgId={orgId}
                projectId={projectId}
                onToggle={this.onToggleFilter} />
            );
          })}
        </tbody>
      </table>
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
