import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import DropdownLink from '../dropdownLink';
import LoadingIndicator from '../loadingIndicator';
import {t} from '../../locale';

const Broadcasts = React.createClass({
  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      broadcasts: [],
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillUnmount() {
    if (this.timer) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.poller) {
      window.clearTimeout(this.poller);
      this.poller = null;
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData(callback) {
    if (this.poller) {
      window.clearTimeout(this.poller);
    }
    this.api.request('/broadcasts/', {
      method: 'GET',
      success: (data) => {
        this.setState({
          broadcasts: data,
          loading: false
        });
        this.poller = window.setTimeout(this.fetchData, 60000);
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
        this.poller = window.setTimeout(this.fetchData, 60000);
      }
    });
  },

  onOpen() {
    this.timer = window.setTimeout(this.markSeen, 1000);
  },

  onClose() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  markSeen() {
    let broadcastIds = this.state.broadcasts.filter((item) => {
      return !item.hasSeen;
    }).map((item) => {
      return item.id;
    });

    if (broadcastIds.length === 0)
      return;

    this.api.request('/broadcasts/', {
      method: 'PUT',
      query: {id: broadcastIds},
      data: {
        hasSeen: '1'
      },
      success: () => {
        this.setState({
          broadcasts: this.state.broadcasts.map((item) => {
            item.hasSeen = true;
            return item;
          })
        });
      },
    });
  },

  render() {
    let {broadcasts, loading} = this.state;
    let unseenCount = broadcasts.filter((item) => {
      return !item.hasSeen;
    }).length;

    let title = <span className="icon-globe" />;
    return (
      <DropdownLink
          topLevelClasses={`broadcasts ${this.props.className || ''} ${unseenCount && 'unseen'}`}
          menuClasses="dropdown-menu-right"
          onOpen={this.onOpen}
          onClose={this.onClose}
          title={title}>
        {loading ?
          <li><LoadingIndicator /></li>
        : (broadcasts.length === 0 ?
          <li className="empty">{t('No recent broadcasts from the Sentry team.')}</li>
        :
          broadcasts.map((item) => {
            return (
              <li key={item.id} className={!item.hasSeen && 'unseen'}>
                {item.title &&
                  <h4>{item.title}</h4>
                }
                {item.message}
                {item.link &&
                  <a href={item.link} className="read-more">{t('Read more')}</a>
                }
              </li>
            );
          })
        )}
      </DropdownLink>
    );
  }
});

export default Broadcasts;
