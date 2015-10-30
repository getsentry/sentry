import React from "react";

import api from "../../api";
import DropdownLink from "../dropdownLink";
import LoadingIndicator from "../loadingIndicator";

var Broadcasts = React.createClass({
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
      clearTimeout(this.timer);
      this.timer = null;
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  fetchData() {
    api.request('/broadcasts/', {
      method: "GET",
      success: (data) => {
        this.setState({
          broadcasts: data,
          loading: false
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  onOpen() {
    this.timer = window.setTimeout(this.markSeen, 3000);
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

    api.request('/broadcasts/', {
      method: "PUT",
      query: {id: broadcastIds},
      data: {
        hasSeen: '1'
      },
      success: () => {
        this.state.broadcasts.forEach((item) => {
          item.hasSeen = true;
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
          <li className="empty">No recent broadcasts from the Sentry team.</li>
        :
          broadcasts.map((item) => {

            if(item.link) {
              return (
                <li key={item.id} className={!item.hasSeen && 'unseen'}>
                  <a href="{item.link}">{item.message}</a>
                </li>
              );
            } else {
              return (
                <li key={item.id} className={!item.hasSeen && 'unseen'}>
                  {item.message}
                </li>
              );
            }
          })
        )}
      </DropdownLink>
    );
  }
});

export default Broadcasts;
