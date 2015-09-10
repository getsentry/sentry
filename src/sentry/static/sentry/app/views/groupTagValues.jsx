import React from "react";
import Router from "react-router";
import jQuery from "jquery";
import api from "../api";
import Count from "../components/count";
import GroupState from "../mixins/groupState";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";
import TimeSince from "../components/timeSince";
import {isUrl, percent} from "../utils";

var GroupTagValues = React.createClass({
  mixins: [GroupState],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      tagKey: null,
      tagValueList: null,
      loading: true,
      error: false,
      pageLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    var querystring = jQuery.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + params.tagKey + '/', {
      success: (data) => {
        this.setState({
          tagKey: data,
          loading: this.state.tagValueList === null
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + params.tagKey + '/values/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          tagValueList: data,
          loading: this.state.tagKey === null,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onPage(cursor) {
    var router = this.context.router;
    var queryParams = jQuery.extend({}, router.getCurrentQuery(), {
      cursor: cursor
    });

    router.transitionTo('groupTagValues', router.getCurrentParams(), queryParams);
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var router = this.context.router;
    var tagKey = this.state.tagKey;
    var children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      var pct = percent(tagValue.count, tagKey.totalValues).toFixed(2);
      var params = router.getCurrentParams();
      return (
        <tr key={tagValueIdx}>
          <td className="bar-cell">
            <span className="bar" style={{width: pct + '%'}}></span>
            <span className="label">{pct}%</span>
          </td>
          <td>
            <Router.Link
                to="stream"
                params={params}
                query={{query: tagKey.key + ':' + '"' + tagValue.value + '"'}}>
              {tagValue.name}
            </Router.Link>
            {isUrl(tagValue.value) &&
              <a href={tagValue.value} className="external">
                <em className="icon-open" />
              </a>
            }
          </td>
          <td>
            <TimeSince date={tagValue.lastSeen} />
          </td>
        </tr>
      );
    });

    return (
      <div>
        <h3>
          {tagKey.name + ' '}
          <small><Count value={tagKey.uniqueValues} /> unique historical values</small>
        </h3>
        <div className="alert alert-info alert-block">
          Data is based on events seen in the last 7 days.
        </div>
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={{width: 30}}>%</th>
              <th>Value</th>
              <th style={{width: 200}}>Last Seen</th>
            </tr>
          </thead>
          <tbody>
            {children}
          </tbody>
        </table>
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default GroupTagValues;
