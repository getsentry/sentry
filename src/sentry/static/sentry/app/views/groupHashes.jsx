import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import GroupState from '../mixins/groupState';

import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import Pagination from '../components/pagination';

import IndicatorStore from '../stores/indicatorStore';

import {t} from '../locale';

const GroupHashRow = React.createClass({
  propTypes: {
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
    let {hash} = this.props;
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
      toggledHashList: new Set()
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
          toggledHashList: new Set(),
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
    let {toggledHashList} = this.state;
    if (enabled) {
      toggledHashList.add(hash.id);
    } else {
      toggledHashList.delete(hash.id);
    }

    this.setState({
      toggledHashList: new Set(toggledHashList)
    });
  },

  handleUnmerge() {
    let {params} = this.props;
    let {toggledHashList} = this.state;

    let ids = toggledHashList.values();

    let loadingIndicator = IndicatorStore.add(t('Unmerging issues..'));
    this.api.request(`/issues/${params.groupId}/hashes/`, {
      method: 'DELETE',
      data: ids,
      success: (data, _, jqXHR) => {
        this.setState({
          hashList: this.state.hashList.filter(hash => !toggledHashList.has(hash.id)),
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
    let children = this.state.hashList.map(hash => {
      return <GroupHashRow hash={hash} key={hash.id} onChange={this.handleHashToggle} />;
    });

    return (
      <div>
        <div className="event-list">
          <table className="table">
            <thead>
              <tr>
                <th>{t('ID')}</th>
                <th
                  className="pull-right"
                  style={{borderBottom: 'none', padding: '8px 20px'}}>
                  <button
                    disabled={this.state.toggledHashList.size === 0}
                    ref="unmerge"
                    className="btn btn-sm btn-default"
                    onClick={this.handleUnmerge}>
                    {t('Unmerge')}
                  </button>
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
