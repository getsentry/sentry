import PropTypes from 'prop-types';
import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Confirm from '../components/confirm';
import {t} from '../locale';
import OrganizationState from '../mixins/organizationState';

const SavedSearchRow = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    access: PropTypes.object.isRequired,
    onDefault: PropTypes.func.isRequired,
    onUserDefault: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: false,
      error: false,
    };
  },

  handleRemove() {
    if (this.state.loading) return;

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
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  handleUpdate(params, cb) {
    if (this.state.loading) return;
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    let {orgId, projectId, data} = this.props;
    this.api.request(`/projects/${orgId}/${projectId}/searches/${data.id}/`, {
      method: 'PUT',
      data: params,
      success: (d, _, jqXHR) => {
        IndicatorStore.remove(loadingIndicator);
        cb();
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
        IndicatorStore.remove(loadingIndicator);
      },
    });
  },

  handleDefault() {
    this.handleUpdate(
      {
        isDefault: true,
      },
      this.props.onDefault
    );
  },

  handleUserDefault() {
    this.handleUpdate(
      {
        isUserDefault: true,
      },
      this.props.onUserDefault
    );
  },

  render() {
    let data = this.props.data;
    return (
      <tr>
        <td>
          <h5 style={{marginBottom: 5}}>{data.name}</h5>
          <code>{data.query}</code>
        </td>
        <td style={{textAlign: 'center'}}>
          <input
            type="radio"
            name="userDefault"
            checked={data.isUserDefault}
            onChange={this.handleUserDefault}
          />
        </td>
        {this.props.access.has('project:write') && (
          <td style={{textAlign: 'center'}}>
            <input
              type="radio"
              name="default"
              checked={data.isDefault}
              onChange={this.handleDefault}
            />
          </td>
        )}
        {this.props.access.has('project:write') && (
          <td style={{textAlign: 'right'}}>
            <Confirm
              message={t('Are you sure you want to remove this?')}
              onConfirm={this.handleRemove}
              disabled={this.state.loading}
            >
              <a className="btn btn-sm btn-default">
                <span className="icon icon-trash" /> &nbsp;{t('Remove')}
              </a>
            </Confirm>
          </td>
        )}
      </tr>
    );
  },
});

const ProjectSavedSearches = React.createClass({
  mixins: [ApiMixin, OrganizationState],

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
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  handleRemovedSearch(data) {
    let savedSearchList = this.state.savedSearchList;
    this.setState({
      savedSearchList: savedSearchList.filter(search => {
        return search.id !== data.id;
      }),
    });
  },

  handleDefaultSearch(data) {
    let savedSearchList = this.state.savedSearchList;
    savedSearchList.forEach(search => {
      search.isDefault = data.id === search.id;
    });
    this.setState({
      savedSearchList,
    });
  },

  handleUserDefaultSearch(data) {
    let savedSearchList = this.state.savedSearchList;
    savedSearchList.forEach(search => {
      search.isUserDefault = data.id === search.id;
    });
    this.setState({
      savedSearchList,
    });
  },

  renderBody() {
    let body;

    if (this.state.loading) body = this.renderLoading();
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.savedSearchList.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

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
    let access = this.getAccess();
    return (
      <div className="panel panel-default horizontal-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Search</th>
              <th style={{textAlign: 'center', width: 140}}>My Default</th>
              {access.has('project:write') && (
                <th style={{textAlign: 'center', width: 140}}>Team Default</th>
              )}
              {access.has('project:write') && <th style={{width: 120}} />}
            </tr>
          </thead>
          <tbody>
            {this.state.savedSearchList.map(search => {
              return (
                <SavedSearchRow
                  access={access}
                  key={search.id}
                  orgId={orgId}
                  projectId={projectId}
                  data={search}
                  onUserDefault={this.handleUserDefaultSearch.bind(this, search)}
                  onDefault={this.handleDefaultSearch.bind(this, search)}
                  onRemove={this.handleRemovedSearch.bind(this, search)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    );
  },

  render() {
    // TODO(dcramer): localize when language is final
    return (
      <div>
        <h2>{t('Saved Searches')}</h2>
        {this.renderBody()}
      </div>
    );
  },
});

export default ProjectSavedSearches;
