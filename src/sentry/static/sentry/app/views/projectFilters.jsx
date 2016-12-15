import React from 'react';
import styled from 'styled-components';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Switch from '../components/switch';
import TooltipMixin from '../mixins/tooltip';
import {t} from '../locale';
import marked from '../utils/marked';

// TODO: Should there just be a filter.slug attribute?

function slugify(text)
{
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

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
            {!data.subFilters.length > 0 && <FilterSwitch {...this.props} size="lg"/>}
          </div>
        </div>

        {data.subFilters.length > 0 &&
          <FilterGrid>
            {data.subFilters.map(filter => {
              return (
                <FilterGridItem>
                  <FilterGridIcon className={ 'icon-' + slugify(filter.name)} />
                  <h5>{filter.name}</h5>
                  <p className="help-block">{filter.description}</p>
                  <FilterSwitch {...this.props} data={filter} size="lg"/>
                </FilterGridItem>
              );
            })}
          </FilterGrid>
        }
      </div>
    );
  }
});

// TODO(ckj): Make this its own generic component at some point

const FilterGrid = styled.div`
  display: flex;
  margin-left: -5px;
  margin-right: -5px;
  margin-bottom: 20px;
`;

const FilterGridItem = styled.div`
  flex: 1;
  margin-left: 5px;
  margin-right: 5px;
  width: 25%;
  background: #F7F8F9;
  border-radius: 3px;
  position: relative;
  padding: 10px 65px 6px 58px;

  && h5 {
    font-size: 15px;
    margin: 0 0 2px;
  }

  && p {
    margin: 0;
  }

  && .switch {
    background: #fff;
    position: absolute;
    top: 17px;
    right: 12px;
  }
`;

const FilterGridIcon = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  width: 38px;
  height: 38px;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 38px 38px;
`;

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
      <div>
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
