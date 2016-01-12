import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {t} from '../locale';

const SavedSearchRow = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  handleRemove(e) {
    e.preventDefault();
    if (this.state.loading)
      return;

    if (!window.confirm('Are you sure you want to remove this?'))
      return;

    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/searches/${data.id}/`, {
      method: 'DELETE',
      success: (d, _, jqXHR) => {
        this.props.onRemove();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  handleDefault() {
    if (this.state.loading) return;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/searches/${data.id}/`, {
      method: 'PUT',
      data: {
        isDefault: true,
      },
      success: (d, _, jqXHR) => {
        this.props.onDefault();
        IndicatorStore.remove(loadingIndicator);
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
        IndicatorStore.remove(loadingIndicator);
      }
    });
  },

  render() {
    let data = this.props.data;
    return (
      <tr>
        <td>
          <h5 style={{marginBottom: 5}}>{data.name}</h5>
          <code>{data.query}</code>
        </td>
        <td style={{textAlign: 'right'}}>
          {data.isDefault ?
            <a className="btn btn-sm btn-default" disabled={true}
               style={{marginRight: 5}}>
              <span className="icon icon-toggle" /> &nbsp;{t('Default')}
            </a>
          :
            <a className="btn btn-sm btn-default" onClick={this.handleDefault}
               disabled={this.state.loading} style={{marginRight: 5}}>
              <span className="icon icon-toggle" /> &nbsp;{t('Make Default')}
            </a>
          }
          <a className="btn btn-sm btn-default" onClick={this.handleRemove}
             disabled={this.state.loading}>
            <span className="icon icon-trash" /> &nbsp;{t('Remove')}
          </a>
        </td>
      </tr>
    );
  }
});

const ProjectSavedSearches = React.createClass({
  propTypes: {
    setProjectNavSection: React.PropTypes.func
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
      savedSearchList: [],
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/searches/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          savedSearchList: data,
          pageLinks: jqXHR.getResponseHeader('Link')
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

  handleRemovedSearch(data) {
    let savedSearchList = this.state.savedSearchList;
    this.setState({
      savedSearchList: savedSearchList.filter((search) => {
        return search.id !== data.id;
      }),
    });
  },

  handleDefaultSearch(data) {
    let savedSearchList = this.state.savedSearchList;
    savedSearchList.forEach((search) => {
      search.isDefault = data.id === search.id;
    });
    this.setState({
      savedSearchList: savedSearchList,
    });
  },

  renderBody() {
    let body;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.savedSearchList.length > 0)
      body = this.renderResults();
    else
      body = this.renderEmpty();

    return body;
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no saved searches for this project.')}</p>
      </div>
    );
  },

  renderResults() {
    let {orgId, projectId} = this.props.params;
    return (
      <table className="table">
        <tbody>
          {this.state.savedSearchList.map((search) => {
            return (
              <SavedSearchRow
                orgId={orgId}
                projectId={projectId}
                data={search}
                onDefault={this.handleDefaultSearch.bind(this, search)}
                onRemove={this.handleRemovedSearch.bind(this, search)} />
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
        <h1>{t('Saved Searches')}</h1>
        {this.renderBody()}
      </div>
    );
  }
});

export default ProjectSavedSearches;
