import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import ActivityItem from './item';
import LoadingError from '../loadingError';
import LoadingIndicator from '../loadingIndicator';
import Pagination from '../pagination';
import {t} from '../../locale';

const ActivityFeed = React.createClass({
  mixins: [ApiMixin],

  getDefaultProps() {
    return {
      pagination: true,
      query: {},
    };
  },

  getInitialState() {
    return {
      itemList: [],
      loading: true,
      error: false,
      pageLinks: null,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    let location = this.props.location;
    let nextLocation = nextProps.location;
    if (location.pathname != nextLocation.pathname || location.search != nextLocation.search) {
      this.remountComponent();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    let location = this.props.location;
    this.api.clear();
    this.api.request(this.props.endpoint, {
      method: 'GET',
      query: {
        cursor: location.query.cursor || '',
        ...this.props.query,
      },
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          itemList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      }
    });
  },

  renderResults() {
    let body;
    let {orgId} = this.props.params;

    if (this.state.loading)
      body = this.renderLoading();
    else if (this.state.error)
      body = <LoadingError onRetry={this.fetchData} />;
    else if (this.state.itemList.length > 0) {
      body = (
        <div className="activity-container">
          <ul className="activity">
            {this.state.itemList.map((item) => {
              return (
                <ActivityItem key={item.id} orgId={orgId} item={item} />
              );
            })}
          </ul>
        </div>
      );
    }
    else
      body = (this.props.renderEmpty || this.renderEmpty)();

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
    return <div className="box empty">{t('Nothing to show here, move along.')}</div>;
  },

  render() {
    return (
      <div>
        {this.renderResults()}
        {this.props.pagination && this.state.pageLinks &&
          <Pagination pageLinks={this.state.pageLinks} {...this.props} />
        }
      </div>
    );
  }
});

export default ActivityFeed;
