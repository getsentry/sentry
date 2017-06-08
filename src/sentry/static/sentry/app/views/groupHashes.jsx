import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';

import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';
import LinkWithConfirmation from '../components/linkWithConfirmation';

import IndicatorStore from '../stores/indicatorStore';

import {t} from '../locale';

const GroupHashRow = React.createClass({
  propTypes: {
    disabled: React.PropTypes.bool,
    hash: React.PropTypes.object.isRequired,
    onChange: React.PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      checked: false
    };
  },

  toggleCheckbox() {
    this.setState({checked: !this.state.checked}, () => {
      this.props.onChange(this.props.hash, this.state.checked);
    });
  },

  render() {
    let {hash, disabled} = this.props;
    return (
      <tr
        key={hash.id}
        onClick={e => {
          // clicking anywhere in the row will toggle the checkbox
          if (e.currentTarget.type !== 'input') this.toggleCheckbox();
        }}>
        <td>
          <h5>{hash.id}</h5>
        </td>
        <td style={{textAlign: 'right'}}>
          <input
            type="checkbox"
            className="chk-select"
            disabled={disabled}
            checked={this.state.checked}
            onChange={this.toggleCheckbox}
          />
        </td>
      </tr>
    );
  }
});

const GroupHashes = React.createClass({
  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      hashList: [],
      loading: true,
      error: false,
      pageLinks: '',
      selectedSet: new Set()
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.params.groupId !== this.props.params.groupId) {
      this.setState(
        {
          hashList: [],
          selectedSet: new Set(),
          loading: true,
          error: false
        },
        this.fetchData
      );
    }
  },

  getEndpoint() {
    let params = this.props.params;
    let queryParams = {
      ...this.props.location.query,
      limit: 50
    };

    return `/issues/${params.groupId}/hashes/?${jQuery.param(queryParams)}`;
  },

  fetchData() {
    let queryParams = this.props.location.query;

    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getEndpoint(), {
      method: 'GET',
      data: queryParams,
      success: (data, _, jqXHR) => {
        this.setState({
          hashList: data,
          error: false,
          loading: false,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  handleHashToggle(hash, enabled) {
    let {selectedSet} = this.state;
    if (enabled) {
      selectedSet.add(hash.id);
    } else {
      selectedSet.delete(hash.id);
    }

    this.setState({
      selectedSet: new Set(selectedSet)
    });
  },

  handleUnmerge() {
    let {params} = this.props;
    let {selectedSet} = this.state;

    let ids = Array.from(selectedSet.values());

    let loadingIndicator = IndicatorStore.add(t('Unmerging issues..'));
    this.api.request(`/issues/${params.groupId}/hashes/`, {
      method: 'DELETE',
      query: {
        id: ids
      },
      success: (data, _, jqXHR) => {
        this.setState({
          hashList: this.state.hashList.filter(hash => !selectedSet.has(hash.id)),
          error: false
        });
        IndicatorStore.add(t('Issues successfully queued for unmerging.'), 'success', {
          duration: 5000
        });
      },
      error: error => {
        this.setState({error: true});
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
        this.setState({loading: false});
      }
    });
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t("There don't seem to be any hashes for this issue.")}</p>
      </div>
    );
  },

  renderResults() {
    let {hashList, selectedSet} = this.state;

    // Need to always leave at least one hash; disable remaining checkboxes
    // if remaining count is 1
    let hashesCount = hashList.length;
    let selectedCount = selectedSet.size;
    let isRemainingDisabled = hashesCount - selectedCount === 1;
    let children = hashList.map(hash => {
      return (
        <GroupHashRow
          hash={hash}
          key={hash.id}
          disabled={isRemainingDisabled && !selectedSet.has(hash.id)}
          onChange={this.handleHashToggle}
        />
      );
    });

    return (
      <div>
        <div className="alert alert-block alert-warning">
          <strong>Warning:</strong>
          {' '}
          This is an experimental feature. Data may become temporarily unavailable when unmerging issues.
        </div>
        <div className="event-list">
          <table className="table">
            <thead>
              <tr>
                <th>{t('ID')}</th>
                <th
                  className="pull-right"
                  style={{borderBottom: 'none', padding: '8px 20px'}}>
                  <LinkWithConfirmation
                    disabled={this.state.selectedSet.size === 0}
                    ref="unmerge"
                    message={t('Are you sure you want to unmerge these issues?')}
                    className="btn btn-sm btn-default"
                    onConfirm={this.handleUnmerge}>
                    {t('Unmerge')}
                  </LinkWithConfirmation>
                </th>
              </tr>
            </thead>
            <tbody>
              {children}
            </tbody>
          </table>
        </div>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  },

  renderBody() {
    let body;

    if (this.state.loading) body = <LoadingIndicator />;
    else if (this.state.error) body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.hashList.length > 0) body = this.renderResults();
    else body = this.renderEmpty();

    return body;
  },

  render() {
    return this.renderBody();
  }
});

export default GroupHashes;
